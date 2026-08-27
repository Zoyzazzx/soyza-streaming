/**
 * Soyza Project — Upload Worker
 * ==============================
 * Watches the MediaMTX recordings folder for completed .mp4 files.
 * When a file is stable (size unchanged for 3 seconds), uploads it
 * to Supabase Storage and inserts a metadata row into the DB.
 *
 * Usage:
 *   node worker.js
 */

require("dotenv").config();
const fs          = require("fs");
const path        = require("path");
const chokidar    = require("chokidar");
const { createClient } = require("@supabase/supabase-js");
const express     = require("express");
const cors        = require("cors");
const { exec }    = require("child_process");

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL    = process.env.SUPABASE_URL;
const SUPABASE_KEY    = process.env.SUPABASE_KEY;     // service_role key!
const RECORDINGS_DIR  = path.resolve(process.env.RECORDINGS_DIR || "../mediamtx/recordings");
const BUCKET          = process.env.SUPABASE_BUCKET || "recordings";

// How long (ms) a file size must stay unchanged before we consider it complete
const STABLE_WAIT_MS  = 3000;
// How often (ms) to poll the file size while waiting for it to stabilise
const POLL_MS         = 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Supabase client
// ─────────────────────────────────────────────────────────────────────────────
global.WebSocket = require('ws');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Track files currently being processed so we don't double-upload
const inProgress = new Set();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getFileSizeBytes(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return -1;
  }
}

function timestamp() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function log(msg) {
  console.log(`[${timestamp()}] ${msg}`);
}

/**
 * Waits until the file size stops changing for STABLE_WAIT_MS milliseconds.
 * Returns true when stable, false if the file disappears.
 */
async function waitForFileStable(filePath) {
  let lastSize = getFileSizeBytes(filePath);
  let stableMs = 0;

  while (stableMs < STABLE_WAIT_MS) {
    await sleep(POLL_MS);

    if (!fs.existsSync(filePath)) return false;

    const currentSize = getFileSizeBytes(filePath);
    if (currentSize === lastSize) {
      stableMs += POLL_MS;
    } else {
      lastSize = currentSize;
      stableMs = 0;
    }
  }
  return true;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Core upload logic
// ─────────────────────────────────────────────────────────────────────────────

async function uploadFile(filePath) {
  const filename = path.basename(filePath);

  // Guard: skip non-mp4 files
  if (!filename.endsWith(".mp4")) return;

  // Guard: skip files already being processed
  if (inProgress.has(filePath)) return;
  inProgress.add(filePath);

  try {
    log(`📁 New recording detected: ${filename}`);
    log(`   Waiting for file to finish writing...`);

    const stable = await waitForFileStable(filePath);
    if (!stable) {
      log(`⚠️  File disappeared before stable: ${filename}`);
      return;
    }

    const fileSizeBytes = getFileSizeBytes(filePath);
    log(`   File stable at ${(fileSizeBytes / 1024 / 1024).toFixed(2)} MB — uploading...`);

    // Read file into buffer
    const fileBuffer = fs.readFileSync(filePath);
    const storagePath = filename;  // e.g. 2026-08-26_21-05-00.mp4

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: "video/mp4",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Get the public URL
    const { data: urlData } = supabase
      .storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // Insert metadata row into recordings table
    const { error: dbError } = await supabase
      .from("recordings")
      .insert({
        filename:         filename,
        storage_path:     storagePath,
        public_url:       publicUrl,
        file_size_bytes:  fileSizeBytes,
        duration_seconds: 30,        // MediaMTX is configured for 30s segments
        upload_status:    "success",
      });

    if (dbError) {
      throw new Error(`DB insert failed: ${dbError.message}`);
    }

    log(`✅ Uploaded: ${filename}`);
    log(`   Public URL: ${publicUrl}`);

  } catch (err) {
    log(`❌ Error processing ${filename}: ${err.message}`);

    // Log failure to DB
    try {
      await supabase.from("recordings").insert({
        filename:      filename,
        storage_path:  filename,
        public_url:    "",
        upload_status: "failed",
      });
    } catch (dbErr) {
      log(`   Could not log failure to DB: ${dbErr.message}`);
    }
  } finally {
    inProgress.delete(filePath);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Start watching
// ─────────────────────────────────────────────────────────────────────────────

function start() {
  console.log("=".repeat(60));
  console.log("  Soyza Project — Upload Worker");
  console.log("=".repeat(60));
  console.log(`  Watching : ${RECORDINGS_DIR}`);
  console.log(`  Bucket   : ${BUCKET}`);
  console.log(`  Stable   : file unchanged for ${STABLE_WAIT_MS / 1000}s before upload`);
  console.log("=".repeat(60));

  // Ensure the recordings directory exists
  if (!fs.existsSync(RECORDINGS_DIR)) {
    console.warn(`⚠️  Recordings directory not found: ${RECORDINGS_DIR}`);
    console.warn("    Make sure MediaMTX is running and has created the recordings folder.");
    fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
    console.log("    Created directory. Waiting for recordings...");
  }

  const watcher = chokidar.watch(RECORDINGS_DIR, {
    persistent: true,
    ignoreInitial: false,       // also process files already in the folder
    awaitWriteFinish: false,    // we do our own stable-size detection
    depth: 5,
  });

  watcher
    .on("add", (filePath) => uploadFile(filePath))
    .on("error", (err) => log(`Watcher error: ${err}`));

  log("👀 Watching for new recordings...");

  // Start Express API server
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.post("/api/stitch", async (req, res) => {
    log("🧵 Stitch command received. Checking for segments...");
    try {
      const targetDir = path.join(RECORDINGS_DIR, "live", "stream");
      if (!fs.existsSync(targetDir)) {
        log("   No live/stream directory found.");
        return res.json({ success: true, message: "No segments found" });
      }

      const files = fs.readdirSync(targetDir)
        .filter(f => f.endsWith(".mp4") && !f.startsWith("master_"))
        .sort(); // Sorting ensures chronological order

      if (files.length === 0) {
        log("   No segments found to stitch.");
        return res.json({ success: true, message: "No segments found" });
      }

      log(`   Found ${files.length} segments. Preparing FFmpeg concat list...`);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const listPath = path.join(targetDir, `list_${timestamp}.txt`);
      const listContent = files.map(f => `file '${f}'`).join("\n");
      fs.writeFileSync(listPath, listContent);

      const masterFile = `master_${timestamp}.mp4`;
      const masterPath = path.join(targetDir, masterFile);

      log(`   Running FFmpeg to create ${masterFile}...`);
      
      const ffmpegPath = "C:\\Users\\Navindra\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-full_build\\bin\\ffmpeg.exe";
      exec(`"${ffmpegPath}" -f concat -safe 0 -i "${listPath}" -c copy "${masterPath}"`, async (error, stdout, stderr) => {
        if (error) {
          log(`❌ FFmpeg failed: ${error.message}`);
          return;
        }
        log(`✅ Successfully stitched ${files.length} segments into ${masterFile}`);
        fs.unlinkSync(listPath); // Cleanup list.txt

        // The watcher will automatically detect and upload the master file!
      });

      res.json({ success: true, message: "Stitching started in background", masterFile });
    } catch (err) {
      log(`❌ Stitch API error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  const PORT = 4000;
  app.listen(PORT, () => {
    log(`🚀 Worker API listening on port ${PORT}`);
  });
}

start();

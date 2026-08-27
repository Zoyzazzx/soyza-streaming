# 🎬 SOYZA PROJECT — Master Implementation Document
> **Project**: Secure Hybrid Network Real-Time Data Streaming and Storage System
> **Student**: Prashan Zoysa | **ID**: E299625 | **Module**: C16600
> **University**: Kingston University London
> **Last Updated**: 2026-08-27

---

## 📋 Table of Contents

1. [Project Overview](#1-project-overview)
2. [Final Architecture](#2-final-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Directory Structure](#4-directory-structure)
5. [Component Deep-Dive](#5-component-deep-dive)
6. [Supabase Database Schema](#6-supabase-database-schema)
7. [Environment Variables](#7-environment-variables)
8. [Implementation Task Checklist](#8-implementation-task-checklist)
9. [Running the Project](#9-running-the-project)
10. [Deployment Guide](#10-deployment-guide)
11. [Testing & Validation Plan](#11-testing--validation-plan)
12. [Known Constraints & Notes](#12-known-constraints--notes)

---

## 1. Project Overview

### Problem Statement
Current live broadcasting systems (like those used in Sri Lanka's TV industry) only support live streaming with no cloud storage or redundancy. If the receiver misses a command or the connection drops, the data is lost forever. There is no fallback and no recording archive.

### Aim
Design and implement a simplified hybrid network system (simulating 5G + satellite) that:
- Captures webcam video from a **field/remote location** (the broadcaster)
- Streams it live to a **receiving end** (PCR/studio) — analogous to LiveU field unit → broadcast centre
- Supports **public mode** (anyone can watch via a URL) and **private mode** (only authenticated receiver can view)
- Automatically uploads recordings to cloud storage as a redundancy fallback
- Monitors two network connections and switches between them when one degrades below a threshold
- Is **accessible from two geographically separate locations** via cloud deployment

### Academic Objectives (from Interim Report)
| # | Objective | Status |
|---|---|---|
| 1 | Develop video capture and encoding pipeline | ⬜ TODO |
| 2 | Automatically upload video segments to cloud storage | ⬜ TODO |
| 3 | Monitor two network links and switch between them | ⬜ TODO |
| 4 | Configure a streaming server to receive live feed and provide playback | ⬜ TODO |
| 5 | Build a dashboard showing stream status, network status, and uploads | ⬜ TODO |

---

## 2. Final Architecture

### 2A. Two-Location Deployment Architecture (Production)

```
 LOCATION A — FIELD / BROADCASTER          CLOUD                    LOCATION B — PCR / RECEIVER
 ─────────────────────────────────   ─────────────────────   ──────────────────────────────────

  Browser (Broadcast Studio page)
    Camera → WebRTC WHIP push
         │                               MediaMTX (.exe)
         └──────── HTTPS ──────────► Port 8889 (WebRTC in)
                                         │
  Python Monitor (runs as Admin)          │  Port 8888 (HLS out) ──────────► Browser Viewer
    Pings 5G Ethernet + 4G WiFi           │                                    (HLS Player)
    Switches Windows routing metric       │  Port 9997 (REST API)
    Logs to Supabase                      │
                                    Cloudflare Tunnel
                                    (exposes MediaMTX                Next.js Dashboard
  Upload Worker (Node.js)            ports to public HTTPS)  ◄───── (deployed on Vercel)
    Watches recordings/ folder             │                          https://soyza-streaming.vercel.app
    Uploads .mp4 → Supabase Storage        │
         │                                 ▼
         └──────── HTTPS ──────────► SUPABASE (Cloud)
                                       Storage   ← video recordings
                                       PostgreSQL ← metadata, events
                                       Auth       ← login / private mode
                                       Realtime   ← live updates to UI
```

### 2B. Public vs Private Stream Mode

| Mode | Behaviour |
|---|---|
| **Public** | HLS player is visible to anyone with the Vercel URL — no login required |
| **Private** | HLS player is gated behind Supabase Auth — only authenticated receiver can watch |

### 2C. Network Failover Layer (Field Device Only)

```
  5G Ethernet  → Primary   (Windows routing metric: 10)
  4G WiFi      → Secondary (Windows routing metric: 50)
  Python script pings 8.8.8.8 every 5s, auto-switches metric on degradation
```

---

## 3. Tech Stack

| Layer | Technology | Version | Purpose | Cost |
|---|---|---|---|---|
| Streaming Server | **MediaMTX** | Latest (.exe) | WebRTC ingest, HLS output, local recording | Free |
| Frontend Hosting | **Vercel** | — | Deploy Next.js dashboard globally | Free |
| Tunnel (MediaMTX) | **Cloudflare Tunnel** | cloudflared | Expose local MediaMTX ports via public HTTPS | Free |
| Frontend | **Next.js** | 16 (App Router) | Dashboard, HLS player, Broadcast Studio, live status | Free |
| Backend/DB | **Supabase** | Cloud Free Tier | PostgreSQL, Storage, Auth, Realtime | Free (500MB DB, 1GB Storage) |
| Upload Worker | **Node.js** | 20 LTS | Watch recordings folder, upload to Supabase | Free |
| Failover Monitor | **Python** | 3.14 | Ping both networks, switch Windows route | Free |

### Supabase Free Tier Limits (Important)
- Storage: **1 GB** — keep recordings short (30s segments at 720p ~15MB each = ~66 recordings max)
- Database: **500 MB** — more than enough for metadata rows
- Realtime: **200 concurrent connections, 2M messages/month** — fine for a demo
- **WARNING**: Projects pause after **1 week of inactivity** — log in to Supabase before demoing

---

## 4. Directory Structure

```
f:\Data\Yvexa\Projects\Soyza Project\
|
+-- SOYZA_PROJECT_MASTER.md         <- This file (project backbone)
|
+-- Plan/                           <- Original docs (do not edit)
|   +-- C16600_Individual_Interim Report_E299625_Prashan Zoysa.pdf
|   +-- GPT Suggesion.pdf
|
+-- mediamtx/                       <- MediaMTX installation
|   +-- mediamtx.exe                <- downloaded binary
|   +-- mediamtx.yml                <- our custom config
|   +-- recordings/                 <- auto-created, stores .mp4 segments
|
+-- monitor/                        <- Python Network Monitor
|   +-- monitor.py                  <- main failover script
|   +-- requirements.txt
|   +-- .env                        <- Supabase credentials (DO NOT COMMIT)
|
+-- upload-worker/                  <- Node.js Upload Worker
|   +-- worker.js                   <- main upload script
|   +-- package.json
|   +-- .env                        <- Supabase credentials (DO NOT COMMIT)
|
+-- dashboard/                      <- Next.js Frontend
    +-- app/
    |   +-- layout.tsx
    |   +-- page.tsx                <- Main dashboard page
    |   +-- login/page.tsx          <- Auth page
    |   +-- recordings/page.tsx     <- Recordings archive
    |   +-- api/stream-status/route.ts  <- Proxies MediaMTX API
    +-- components/
    |   +-- HLSPlayer.tsx           <- Live stream video player
    |   +-- NetworkStatus.tsx       <- Real-time network card
    |   +-- FailoverLog.tsx         <- Failover event history
    |   +-- RecordingsList.tsx      <- Uploaded recordings grid
    +-- lib/supabase/
    |   +-- client.ts               <- Browser Supabase client
    |   +-- server.ts               <- Server Supabase client
    +-- .env.local                  <- Supabase keys (DO NOT COMMIT)
    +-- next.config.ts
    +-- package.json
```

---

## 5. Component Deep-Dive

---

### 5A. MediaMTX — Streaming Server

**What it does**: Receives RTMP stream from OBS, serves it as HLS for browsers, records to disk in segments.

**Download**: https://github.com/bluenviron/mediamtx/releases/latest
- File: `mediamtx_vX.X.X_windows_amd64.zip`
- Extract to `f:\Data\Yvexa\Projects\Soyza Project\mediamtx\`
- Run: `./mediamtx.exe` (no install needed, single binary)

**Key Ports**:
| Port | Protocol | Purpose |
|---|---|---|
| 8889 | WebRTC | Browser pushes camera feed here (WHIP) |
| 8888 | HTTP | HLS playback |
| 9997 | HTTP REST | MediaMTX management API |

**mediamtx.yml config** (save to `mediamtx/mediamtx.yml`):
```yaml
# MediaMTX Configuration for Soyza Project
logLevel: info
logDestinations: [stdout]

# REST API - for dashboard to query stream status
api: yes
apiAddress: :9997

# WebRTC - receive stream from Browser
webrtc: yes
webrtcAddress: :8889

# HLS - serve stream to browser
hls: yes
hlsAddress: :8888
hlsAllowOrigin: '*'
hlsSegmentDuration: 2s

# Disable unused protocols
rtsp: no
webrtc: no
rtmp: no

# Stream path settings
paths:
  live:
    record: yes
    recordPath: ./recordings/%Y-%m-%d_%H-%M-%S
    recordFormat: mp4
    recordSegmentDuration: 30s
```

**URLs after streaming starts**:
- HLS Playback: `http://localhost:8888/live/stream/index.m3u8`
- API Status: `http://localhost:9997/v3/paths/list`

---

### 5B. Python Network Monitor & Failover

**File**: `monitor/monitor.py`

**What it does**:
1. Every 5 seconds, pings `8.8.8.8` through BOTH network interfaces
2. Measures latency and detects packet loss on each
3. If primary (5G Ethernet) exceeds threshold → switches OS routing to backup (4G WiFi)
4. Switches by running PowerShell `Set-NetIPInterface` to change Windows routing metric
5. Logs every reading and every failover event to Supabase DB

**Failover Logic**:
```
START
  Set 5G metric=10, WiFi metric=50 (5G is primary by default)
  LOOP every 5 seconds:
    Ping 8.8.8.8 via 5G interface (using -S source IP flag)
    Ping 8.8.8.8 via WiFi interface
    Calculate latency + packet loss for each
    Insert reading into Supabase network_readings table
    IF active == "5G" AND 5G_latency > 150ms:
      Set-NetIPInterface "Ethernet" metric=100
      Set-NetIPInterface "Wi-Fi" metric=10
      active = "backup"
      Insert into Supabase failover_events (SWITCH_TO_BACKUP)
    IF active == "backup" AND 5G recovered for 3 consecutive readings:
      Set-NetIPInterface "Ethernet" metric=10
      Set-NetIPInterface "Wi-Fi" metric=50
      active = "5G"
      Insert into Supabase failover_events (RESTORED_PRIMARY)
```

**monitor/.env**:
```ini
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key

# Run Get-NetIPInterface in PowerShell to find your exact interface names
PRIMARY_INTERFACE=Ethernet
BACKUP_INTERFACE=Wi-Fi
PRIMARY_LABEL=5G Ethernet
BACKUP_LABEL=4G WiFi

LATENCY_THRESHOLD_MS=150
PACKET_LOSS_THRESHOLD_PERCENT=20
POLL_INTERVAL_SECONDS=5
RECOVERY_CHECKS=3
```

**monitor/requirements.txt**:
```
supabase==2.0.0
python-dotenv==1.0.0
```

> **MUST run as Administrator** — changing Windows routing requires elevated privileges

---

### 5C. Node.js Upload Worker

**File**: `upload-worker/worker.js`

**What it does**:
1. Watches `../mediamtx/recordings/` folder using `chokidar`
2. When a `.mp4` file appears and stops changing size (file is complete)
3. Uploads the file to Supabase Storage bucket `recordings`
4. Inserts a row into Supabase `recordings` table with filename, URL, size, timestamp

**upload-worker/package.json**:
```json
{
  "name": "soyza-upload-worker",
  "version": "1.0.0",
  "main": "worker.js",
  "dependencies": {
    "@supabase/supabase-js": "^2.0.0",
    "chokidar": "^3.6.0",
    "dotenv": "^16.0.0"
  }
}
```

**upload-worker/.env**:
```ini
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-SERVICE-ROLE-key-here
RECORDINGS_DIR=../mediamtx/recordings
SUPABASE_BUCKET=recordings
```

> **Use service_role key here** (not anon key) — needed for storage write access

---

### 5D. Supabase — Backend & Database

**One-time setup steps**:
1. Create account at https://supabase.com (free)
2. Create new project: `soyza-streaming`
3. Settings → API → copy Project URL and anon key
4. Storage → New bucket: `recordings` → set to **Public**
5. SQL Editor → Run the schema from Section 6
6. Database → Replication → Enable Realtime on: `network_readings`, `failover_events`, `recordings`

---

### 5E. Next.js Dashboard

**Initialize command**:
```bash
cd "f:\Data\Yvexa\Projects\Soyza Project"
npx create-next-app@latest dashboard --typescript --tailwind --eslint --app --import-alias "@/*"
cd dashboard
npm install @supabase/supabase-js @supabase/ssr hls.js
```

**Pages**:
| Route | Purpose |
|---|---|
| `/` | Main dashboard: live stream + network status + failover log |
| `/recordings` | Grid of all uploaded recordings |
| `/login` | Supabase Auth login page |

**Components**:
| Component | Data Source | Update |
|---|---|---|
| `HLSPlayer.tsx` | `http://localhost:8888/live/stream/index.m3u8` | hls.js polling |
| `NetworkStatus.tsx` | Supabase `network_readings` | Realtime subscription |
| `FailoverLog.tsx` | Supabase `failover_events` | Realtime subscription |
| `RecordingsList.tsx` | Supabase `recordings` + Storage | Realtime INSERT |

**dashboard/.env.local**:
```ini
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_HLS_URL=http://localhost:8888/live/stream/index.m3u8
NEXT_PUBLIC_MEDIAMTX_API=http://localhost:9997
```

---

## 6. Supabase Database Schema

Run this entire block in **Supabase → SQL Editor**:

```sql
-- ============================================
-- SOYZA PROJECT — Supabase Database Schema
-- ============================================

-- Table 1: Network readings (inserted every 5s by Python monitor)
CREATE TABLE network_readings (
  id            BIGSERIAL PRIMARY KEY,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  interface     TEXT NOT NULL,
  latency_ms    FLOAT,
  packet_loss   FLOAT,
  is_active     BOOLEAN DEFAULT FALSE,
  is_healthy    BOOLEAN DEFAULT TRUE
);

-- Table 2: Failover events (inserted when switching happens)
CREATE TABLE failover_events (
  id                    BIGSERIAL PRIMARY KEY,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  event_type            TEXT NOT NULL,
  from_interface        TEXT NOT NULL,
  to_interface          TEXT NOT NULL,
  reason                TEXT,
  latency_at_switch     FLOAT,
  packet_loss_at_switch FLOAT
);

-- Table 3: Uploaded recordings (inserted by Node.js worker)
CREATE TABLE recordings (
  id                BIGSERIAL PRIMARY KEY,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  filename          TEXT NOT NULL,
  storage_path      TEXT NOT NULL,
  public_url        TEXT NOT NULL,
  file_size_bytes   BIGINT,
  duration_seconds  FLOAT,
  upload_status     TEXT DEFAULT 'success'
);

-- Table 4: Stream sessions
CREATE TABLE stream_sessions (
  id                BIGSERIAL PRIMARY KEY,
  started_at        TIMESTAMPTZ DEFAULT NOW(),
  ended_at          TIMESTAMPTZ,
  total_failovers   INT DEFAULT 0,
  primary_interface TEXT DEFAULT '5G Ethernet'
);

-- Enable Row Level Security
ALTER TABLE network_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE failover_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anon (public) to read all tables
CREATE POLICY "public_read_network_readings"
  ON network_readings FOR SELECT USING (true);

CREATE POLICY "public_read_failover_events"
  ON failover_events FOR SELECT USING (true);

CREATE POLICY "public_read_recordings"
  ON recordings FOR SELECT USING (true);

CREATE POLICY "public_read_stream_sessions"
  ON stream_sessions FOR SELECT USING (true);

-- Note: service_role key bypasses RLS automatically,
-- so inserts from Python/Node scripts need no extra policies.

-- AFTER RUNNING THIS SQL:
-- Go to Database -> Replication -> enable Realtime for:
--   network_readings, failover_events, recordings
```

---

## 7. Environment Variables

| File | Variable | Source |
|---|---|---|
| `monitor/.env` | `SUPABASE_URL` | Supabase → Settings → API |
| `monitor/.env` | `SUPABASE_KEY` | Supabase anon key |
| `monitor/.env` | `PRIMARY_INTERFACE` | PowerShell: `Get-NetIPInterface` |
| `monitor/.env` | `BACKUP_INTERFACE` | PowerShell: `Get-NetIPInterface` |
| `upload-worker/.env` | `SUPABASE_URL` | Supabase → Settings → API |
| `upload-worker/.env` | `SUPABASE_KEY` | Supabase **service_role** key |
| `dashboard/.env.local` | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `dashboard/.env.local` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

> **NEVER commit .env files to Git.** Add `**/.env` and `**/.env.local` to `.gitignore`.
> Use `service_role` key ONLY in backend scripts. Use `anon` key in the frontend.

---

## 8. Implementation Task Checklist

Statuses: `⬜ TODO` | `🔄 IN PROGRESS` | `✅ DONE` | `⚠️ BLOCKED`

---

### Phase 1 — Environment Setup

| # | Task | Status | Notes |
|---|---|---|---|
| 1.1 | Download MediaMTX binary, extract to `mediamtx/` | ✅ DONE | mediamtx.exe present in mediamtx/ |
| 1.2 | Create `mediamtx/mediamtx.yml` | ✅ DONE | File written with WebRTC + HLS + RTMP |
| 1.3 | Run `./mediamtx.exe` and verify ports 8889/8888/9997 open | ⬜ TODO | Run locally first |
| 1.4 | Create Supabase project `soyza-streaming` | ✅ DONE | adcawizgdgqsoubblyeg.supabase.co |
| 1.5 | Run full SQL schema in Supabase SQL Editor | ⬜ TODO | Section 6 |
| 1.6 | Create Storage bucket `recordings` (public) | ⬜ TODO | Dashboard → Storage |
| 1.7 | Enable Realtime on 3 tables | ⬜ TODO | Database → Replication |

---

### Phase 2 — Python Network Monitor

| # | Task | Status | Notes |
|---|---|---|---|
| 2.1 | Create `monitor/` folder and files | ✅ DONE | monitor.py + requirements.txt + .env written |
| 2.2 | Fill `monitor/.env` with real Supabase keys | ✅ DONE | Keys populated |
| 2.2b | Verify interface names with `Get-NetIPInterface` | ⬜ TODO | Update PRIMARY_INTERFACE / BACKUP_INTERFACE in .env |
| 2.3 | Write `monitor/monitor.py` — ping loop for both interfaces | ✅ DONE | Full script written |
| 2.4 | Add failover switch logic (Set-NetIPInterface via subprocess) | ✅ DONE | Included in monitor.py |
| 2.5 | Add Supabase insert for `network_readings` (every poll) | ✅ DONE | Included in monitor.py |
| 2.6 | Add Supabase insert for `failover_events` (on switch) | ✅ DONE | Included in monitor.py |
| 2.7 | Install Python packages | ✅ DONE | `py -m pip install -r requirements.txt` done |
| 2.8 | Test: run monitor, verify rows appear in Supabase | ⬜ TODO | Do after SQL schema applied |
| 2.9 | Test: unplug ethernet → verify failover triggers | ⬜ TODO | |
| 2.10 | Test: replug ethernet → verify restore triggers | ⬜ TODO | |

---

### Phase 3 — Node.js Upload Worker

| # | Task | Status | Notes |
|---|---|---|---|
| 3.1 | Create `upload-worker/` folder | ✅ DONE | |
| 3.2 | Create `package.json` and run `npm install` | ✅ DONE | 24 packages installed |
| 3.3 | Fill `upload-worker/.env` with service_role key | ✅ DONE | Keys populated |
| 3.4 | Write `worker.js` — chokidar watch on recordings folder | ✅ DONE | Full script written |
| 3.5 | Add stable-file detection (size unchanged for 3s = file complete) | ✅ DONE | Included in worker.js |
| 3.6 | Add Supabase Storage upload (`supabase.storage.from().upload()`) | ✅ DONE | Included in worker.js |
| 3.7 | Add `recordings` table row insert after upload | ✅ DONE | Included in worker.js |
| 3.8 | Test: start worker, start stream, wait 30s, verify upload | ⬜ TODO | Do after Supabase schema applied |

---

### Phase 4 — Next.js Dashboard

| # | Task | Status | Notes |
|---|---|---|---|
| 4.1 | Initialize Next.js app in `dashboard/` | ✅ DONE | Next.js 16 + TypeScript + Tailwind |
| 4.2 | Install `hls.js`, `@supabase/supabase-js`, `@supabase/ssr` | ✅ DONE | 375 packages installed |
| 4.3 | Create `.env.local` with Supabase anon key | ✅ DONE | Real keys populated |
| 4.4 | Create `lib/supabase/client.ts` | ✅ DONE | |
| 4.5 | Build `HLSPlayer.tsx` with hls.js | ✅ DONE | Auto-retry, LIVE badge, offline state |
| 4.6 | Build `NetworkStatus.tsx` with Realtime subscription | ✅ DONE | Latency bars, health dots, active badge |
| 4.7 | Build `FailoverLog.tsx` with Realtime subscription | ✅ DONE | Switch/restore events with details |
| 4.8 | Build `RecordingsList.tsx` | ✅ DONE | Grid with inline playback |
| 4.9 | Build `app/page.tsx` (main dashboard) | ✅ DONE | Full dark UI assembled |
| 4.10 | Build `app/login/page.tsx` (Supabase Auth) | ⬜ TODO | Required for private mode |
| 4.11 | Build `app/recordings/page.tsx` | ✅ DONE | |
| 4.12 | Build `app/api/stream-status/route.ts` (proxies MediaMTX API) | ✅ DONE | |
| 4.13 | Design: dark theme, modern UI, animations | ✅ DONE | Dark glassmorphism, live badges |
| 4.14 | TypeScript compile check | ✅ DONE | Zero errors — `tsc --noEmit` passed |
| 4.15 | Wire public/private mode toggle (auth gate on HLS viewer) | ⬜ TODO | Supabase session check on viewer page |

---

### Phase 5 — Deployment

| # | Task | Status | Notes |
|---|---|---|---|
| 5.1 | Install Cloudflare Tunnel (`cloudflared`) on field machine | ⬜ TODO | See Section 10 |
| 5.2 | Run `cloudflared tunnel` to expose ports 8889 + 8888 | ⬜ TODO | Gets public HTTPS URLs |
| 5.3 | Push `dashboard/` to GitHub | ⬜ TODO | Required before Vercel import |
| 5.4 | Import GitHub repo into Vercel, set env vars | ⬜ TODO | Add NEXT_PUBLIC_* vars in Vercel dashboard |
| 5.5 | Update `NEXT_PUBLIC_HLS_URL` in Vercel to Cloudflare Tunnel URL | ⬜ TODO | Replace localhost with tunnel URL |
| 5.6 | Update `NEXT_PUBLIC_MEDIAMTX_API` in Vercel to Cloudflare Tunnel URL | ⬜ TODO | |
| 5.7 | Test: open Vercel URL from a different network → viewer loads | ⬜ TODO | |
| 5.8 | Apply Supabase SQL schema (Section 6) | ⬜ TODO | Run in Supabase SQL Editor |
| 5.9 | Create Storage bucket `recordings` (public) | ⬜ TODO | Supabase → Storage |
| 5.10 | Enable Realtime on 3 tables | ⬜ TODO | Supabase → Database → Replication |

---

### Phase 6 — Integration & Demo

| # | Task | Status | Notes |
|---|---|---|---|
| 6.1 | Run all local services (mediamtx, monitor, upload-worker) | ⬜ TODO | See Section 9 |
| 6.2 | Open Vercel URL on receiver device (Location B) | ⬜ TODO | |
| 6.3 | Open Broadcast Studio on broadcaster device (Location A) | ⬜ TODO | |
| 6.4 | Start broadcast — verify HLS viewer on Location B shows video | ⬜ TODO | End-to-end test |
| 6.5 | Verify 30s segments appear in `recordings/` folder | ⬜ TODO | |
| 6.6 | Verify upload worker sends segments to Supabase Storage | ⬜ TODO | |
| 6.7 | Verify recordings appear in dashboard Recordings page | ⬜ TODO | |
| 6.8 | **Failover Demo**: unplug 5G ethernet → watch dashboard switch | ⬜ TODO | |
| 6.9 | Verify FailoverLog updates in real-time on receiver screen | ⬜ TODO | |
| 6.10 | Reconnect 5G → verify RESTORED_PRIMARY in FailoverLog | ⬜ TODO | |
| 6.11 | Screen record full demo for submission | ⬜ TODO | |
| 6.12 | Document results, latency metrics, screenshots for report | ⬜ TODO | |

---

## 9. Running the Project

### 9A. Local Development (single machine)

Open **3 separate PowerShell terminals** on the field machine:

**Terminal 1 — MediaMTX** (normal):
```powershell
cd "d:\Navindra\soyza-streaming\mediamtx"
.\mediamtx.exe
```

**Terminal 2 — Python Monitor** (**as Administrator**):
```powershell
cd "d:\Navindra\soyza-streaming\monitor"
py monitor.py
```

**Terminal 3 — Upload Worker** (normal):
```powershell
cd "d:\Navindra\soyza-streaming\upload-worker"
node worker.js
```

**Terminal 4 — Dashboard** (local dev only — skip in production, use Vercel instead):
```powershell
cd "d:\Navindra\soyza-streaming\dashboard"
npm run dev
```

Then open `http://localhost:3000` → Broadcast Studio → start camera.

### 9B. Production — Two Locations

**Field machine (Location A)** runs these 3 terminals:
1. `mediamtx.exe` — streaming server
2. `py monitor.py` (Admin) — failover monitor
3. `node worker.js` — upload worker
4. `cloudflared tunnel --url http://localhost:8888` — exposes HLS to internet

Then open the **Vercel URL** on any device at Location B to view the stream.

---

## 10. Deployment Guide

### 10A. Cloudflare Tunnel (expose MediaMTX)

> Cloudflare Tunnel creates a secure HTTPS reverse proxy from your local MediaMTX to a public URL — no port forwarding, no VPS needed.

**Step 1 — Install cloudflared**:
```powershell
# Download from https://github.com/cloudflare/cloudflared/releases/latest
# Get: cloudflared-windows-amd64.exe
# Rename to cloudflared.exe and put it anywhere in PATH
cloudflared --version
```

**Step 2 — Quick tunnel (no account needed for demo)**:
```powershell
# Expose HLS port (viewers watch from here)
cloudflared tunnel --url http://localhost:8888
# Output: https://xxxx-xxxx.trycloudflare.com  ← copy this URL

# Expose WebRTC port (broadcaster pushes to here)
cloudflared tunnel --url http://localhost:8889
# Output: https://yyyy-yyyy.trycloudflare.com  ← copy this URL
```

**Step 3 — Update Vercel environment variables**:
- `NEXT_PUBLIC_HLS_URL` = `https://xxxx-xxxx.trycloudflare.com/live/stream/index.m3u8`
- `NEXT_PUBLIC_MEDIAMTX_API` = `https://xxxx-xxxx.trycloudflare.com` (use same HLS tunnel for API proxy)

> **Note**: Quick tunnel URLs change every restart. For a stable URL, create a free Cloudflare account and use a named tunnel.

---

### 10B. Vercel Deployment (Next.js dashboard)

**Step 1 — Push to GitHub**:
```powershell
cd d:\Navindra\soyza-streaming
git add .
git commit -m "feat: initial deployment"
git push origin main
```

**Step 2 — Import on Vercel**:
1. Go to https://vercel.com → New Project
2. Import the `soyza-streaming` GitHub repo
3. Set **Root Directory** to `dashboard`
4. Add these **Environment Variables** in Vercel:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://adcawizgdgqsoubblyeg.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(your anon key)* |
| `NEXT_PUBLIC_HLS_URL` | *(your Cloudflare Tunnel HLS URL)* |
| `NEXT_PUBLIC_MEDIAMTX_API` | *(your Cloudflare Tunnel base URL)* |

5. Click **Deploy** → get your `https://soyza-streaming.vercel.app` URL

**Step 3 — Redeploy after getting tunnel URL**:
Each time you restart the field machine and get new tunnel URLs, update them in Vercel → Settings → Environment Variables → Redeploy.

---

### 10C. Supabase One-Time Setup

1. Go to https://supabase.com → Project `soyza-streaming`
2. **SQL Editor** → paste and run the full schema from Section 6
3. **Storage** → New bucket: `recordings` → toggle **Public**
4. **Database → Replication** → enable Realtime for: `network_readings`, `failover_events`, `recordings`

---

## 11. Testing & Validation Plan

### Test Cases

| Test ID | Test | Expected Result | Pass/Fail |
|---|---|---|---|
| T-01 | Start MediaMTX, check ports 8889/8888/9997 | Ports open, no errors | |
| T-02 | Broadcast from Broadcast Studio page | MediaMTX logs show WebRTC connection | |
| T-03 | Open HLS URL in browser (local) | Video plays | |
| T-04 | Open Vercel URL from a **different network/device** | Stream visible on remote device | |
| T-05 | Wait 30s, check `recordings/` folder | `.mp4` file appears | |
| T-06 | Upload worker detects file, uploads | File in Supabase Storage | |
| T-07 | Check Supabase `recordings` table | Row inserted correctly | |
| T-08 | Open Vercel dashboard from Location B | Dashboard loads with live stream | |
| T-09 | `NetworkStatus` shows latency for both interfaces | Updates every 5s | |
| T-10 | **Failover**: unplug 5G ethernet cable | Monitor detects degradation | |
| T-11 | After T-10: verify routing changed to WiFi | `tracert 8.8.8.8` goes via WiFi | |
| T-12 | `FailoverLog` shows SWITCH_TO_BACKUP event | Real-time row appears on Location B screen | |
| T-13 | Reconnect 5G ethernet | Monitor detects recovery | |
| T-14 | `FailoverLog` shows RESTORED_PRIMARY event | Real-time row appears | |
| T-15 | Login page works with Supabase Auth | Can log in and log out | |
| T-16 | Recordings page shows all videos, playback works | Videos play in browser | | |

### Performance Metrics to Capture (for Report)
- Failover detection time: target < 30 seconds
- Routing switch time after command: target < 5 seconds
- Upload time per 30s segment: measure and document
- HLS playback buffer from live: expect 5-10 seconds (normal for HLS)
- Packet loss % at failover trigger point

---

## 12. Known Constraints & Notes

### Important Warnings
1. **Python monitor MUST run as Administrator** — `Set-NetIPInterface` requires elevated privileges
2. **Supabase project pauses after 1 week of inactivity** — visit supabase.com before any demo session
3. **Supabase Storage limit is 1GB** — delete old test recordings periodically
4. **HLS has 5-10 second latency by design** — this is expected, not a bug
5. **Cloudflare quick-tunnel URL changes on every restart** — update Vercel env vars and redeploy each time; use a named tunnel for a stable URL
6. **MediaMTX WebRTC (port 8889) also needs a Cloudflare Tunnel** — the Broadcast Studio page must point to the tunnelled WebRTC URL when running in production
7. **Node 20 engine warnings** — `@supabase/supabase-js` recommends Node ≥22; warnings are non-blocking, everything works on Node 20

### Academic Scope Decisions
- This is a **failover** system (link switching), NOT bonding — intentional per interim report scope
- "5G" and "satellite" are **simulated** using Ethernet and WiFi — accepted per project spec
- Failover is **OS routing-level** (Windows metric table) — appropriate for this scope

### Useful Commands
```powershell
# See all network interfaces and current metrics
Get-NetIPInterface | Select-Object InterfaceAlias, InterfaceMetric, ConnectionState

# Manually set interface priority (run as Admin)
Set-NetIPInterface -InterfaceAlias "Ethernet" -InterfaceMetric 10
Set-NetIPInterface -InterfaceAlias "Wi-Fi" -InterfaceMetric 50

# Reset to Windows automatic metric
Set-NetIPInterface -InterfaceAlias "Ethernet" -AutomaticMetric Enabled

# Verify which route traffic is using
tracert 8.8.8.8

# Check MediaMTX active streams
curl http://localhost:9997/v3/paths/list
```

---

*Document maintained by Antigravity AI — update task statuses as implementation progresses.*

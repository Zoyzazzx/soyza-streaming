# 🎬 SOYZA PROJECT — Master Implementation Document
> **Project**: Secure Hybrid Network Real-Time Data Streaming and Storage System
> **Student**: Prashan Zoysa | **ID**: E299625 | **Module**: C16600
> **University**: Kingston University London
> **Last Updated**: 2026-08-26

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
10. [Testing & Validation Plan](#10-testing--validation-plan)
11. [Known Constraints & Notes](#11-known-constraints--notes)

---

## 1. Project Overview

### Problem Statement
Current live broadcasting systems (like those used in Sri Lanka's TV industry) only support live streaming with no cloud storage or redundancy. If the receiver misses a command or the connection drops, the data is lost forever. There is no fallback and no recording archive.

### Aim
Design and implement a simplified hybrid network system (simulating 5G + satellite) that:
- Captures webcam video
- Streams it live to a browser-based viewer
- Automatically uploads recordings to cloud storage
- Monitors two network connections and switches between them when one degrades below a threshold

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

```
+------------------------------------------------------------------+
|                        YOUR PC (Local Machine)                   |
|                                                                  |
|   Camera (Browser WebRTC)                                        |
|        |                                                         |
|        |  WebRTC WHIP push (http://localhost:8889)               |
|        v                                                         |
|   +-------------+                                                |
|   |  MediaMTX   |  <- Free open-source streaming server (.exe)  |
|   |             |    Port 8889 (WebRTC in)                       |
|   |             |    Port 8888 (HLS out)                         |
|   |             |    Port 9997 (REST API)                        |
|   +------+------+                                                |
|          |                                                        |
|    +-----+--------------------+                                  |
|    |                          |                                  |
|  HLS Stream           Recording files                            |
|  (viewers watch)      saved to local folder                      |
|                       ./recordings/                              |
|                              |                                   |
|                       Node.js Upload Worker                      |
|                       (watches folder with chokidar)             |
|                              |                                   |
|   Python Monitor Script      |                                   |
|   (pings 5G + 4G every 5s)   |                                   |
|   -> adjusts Windows routing |                                   |
|   -> logs events to Supabase |                                   |
+------------------------------+-----------------------------------+
                               | HTTPS
                               v
                    +---------------------+
                    |      SUPABASE       |
                    |  (Free Tier - Cloud)|
                    |                     |
                    |  Storage            |  <- video recordings
                    |  PostgreSQL DB      |  <- metadata, events
                    |  Auth               |  <- login for dashboard
                    |  Realtime           |  <- live updates to UI
                    +----------+----------+
                               |
                    +----------v----------+
                    |   Next.js Dashboard |
                    |   (React frontend)  |
                    |                     |
                    |  - Broadcaster Studio (WebRTC sender)
                    |  - Live HLS player (viewer)
                    |  - Network status   |
                    |  - Failover log     |
                    |  - Recordings list  |
                    |  - Auth (login)     |
                    +---------------------+

Network Layer (Your PC)
  5G Ethernet  -> Primary   (Windows routing metric: 10)
  4G WiFi      -> Secondary (Windows routing metric: 50)
  Python script watches both and adjusts metric dynamically
```

---

## 3. Tech Stack

| Layer | Technology | Version | Purpose | Cost |
|---|---|---|---|---|
| Streaming Server | **MediaMTX** | Latest (.exe) | RTMP ingest, HLS output, local recording | Free |
| Frontend | **Next.js** | 15 (App Router) | Dashboard, HLS player, live status | Free |
| Backend/DB | **Supabase** | Cloud Free Tier | PostgreSQL, Storage, Auth, Realtime | Free (500MB DB, 1GB Storage) |
| Upload Worker | **Node.js** | 20+ LTS | Watch recordings folder, upload to Supabase | Free |
| Failover Monitor | **Python** | 3.11+ | Ping both networks, switch Windows route | Free |
| Streaming Input | **OBS Studio** | Latest | Push camera feed via RTMP to MediaMTX | Free |

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
| 1.1 | Download MediaMTX binary, extract to `mediamtx/` | ⬜ TODO | github.com/bluenviron/mediamtx/releases |
| 1.2 | Create `mediamtx/mediamtx.yml` | ✅ DONE | File written with WebRTC |
| 1.3 | Run `./mediamtx.exe` and verify ports 8889/8888/9997 open | ⬜ TODO | Need to download binary first |
| 1.4 | Create Supabase project `soyza-streaming` | ⬜ TODO | supabase.com |
| 1.5 | Run full SQL schema in Supabase SQL Editor | ⬜ TODO | Section 6 |
| 1.6 | Create Storage bucket `recordings` (public) | ⬜ TODO | Dashboard → Storage |
| 1.7 | Enable Realtime on 3 tables | ⬜ TODO | Database → Replication |

---

### Phase 2 — Python Network Monitor

| # | Task | Status | Notes |
|---|---|---|---|
| 2.1 | Create `monitor/` folder and files | ✅ DONE | monitor.py + requirements.txt + .env written |
| 2.2 | Fill `monitor/.env` with real interface names + Supabase keys | ⬜ TODO | Run `Get-NetIPInterface` in PowerShell, then update .env |
| 2.3 | Write `monitor/monitor.py` — ping loop for both interfaces | ✅ DONE | Full script written |
| 2.4 | Add failover switch logic (Set-NetIPInterface via subprocess) | ✅ DONE | Included in monitor.py |
| 2.5 | Add Supabase insert for `network_readings` (every poll) | ✅ DONE | Included in monitor.py |
| 2.6 | Add Supabase insert for `failover_events` (on switch) | ✅ DONE | Included in monitor.py |
| 2.7 | Test: run monitor, verify rows appear in Supabase | ⬜ TODO | Do after Supabase is set up |
| 2.8 | Test: unplug ethernet → verify failover triggers | ⬜ TODO | |
| 2.9 | Test: replug ethernet → verify restore triggers | ⬜ TODO | |

---

### Phase 3 — Node.js Upload Worker

| # | Task | Status | Notes |
|---|---|---|---|
| 3.1 | Create `upload-worker/` folder | ✅ DONE | |
| 3.2 | Create `package.json` and run `npm install` | ✅ DONE | 24 packages installed |
| 3.3 | Fill `upload-worker/.env` with service_role key | ⬜ TODO | Need Supabase service_role key |
| 3.4 | Write `worker.js` — chokidar watch on recordings folder | ✅ DONE | Full script written |
| 3.5 | Add stable-file detection (size unchanged for 3s = file complete) | ✅ DONE | Included in worker.js |
| 3.6 | Add Supabase Storage upload (`supabase.storage.from().upload()`) | ✅ DONE | Included in worker.js |
| 3.7 | Add `recordings` table row insert after upload | ✅ DONE | Included in worker.js |
| 3.8 | Test: start worker, start stream, wait 30s, verify upload | ⬜ TODO | Do after Supabase is set up |

---

### Phase 4 — Next.js Dashboard

| # | Task | Status | Notes |
|---|---|---|---|
| 4.1 | Initialize Next.js app in `dashboard/` | ✅ DONE | Next.js 16 + TypeScript + Tailwind |
| 4.2 | Install `hls.js`, `@supabase/supabase-js`, `@supabase/ssr` | ✅ DONE | 11 packages added |
| 4.3 | Create `.env.local` with Supabase anon key | ✅ DONE | Template created — needs real keys |
| 4.4 | Create `lib/supabase/client.ts` | ✅ DONE | |
| 4.5 | Build `HLSPlayer.tsx` with hls.js | ✅ DONE | Auto-retry, LIVE badge, offline state |
| 4.6 | Build `NetworkStatus.tsx` with Realtime subscription | ✅ DONE | Latency bars, health dots, active badge |
| 4.7 | Build `FailoverLog.tsx` with Realtime subscription | ✅ DONE | Switch/restore events with details |
| 4.8 | Build `RecordingsList.tsx` | ✅ DONE | Grid with inline playback |
| 4.9 | Build `app/page.tsx` (main dashboard) | ✅ DONE | Full dark UI assembled |
| 4.10 | Build `app/login/page.tsx` (Supabase Auth) | ⬜ TODO | Optional — can add after core works |
| 4.11 | Build `app/recordings/page.tsx` | ✅ DONE | |
| 4.12 | Build `app/api/stream-status/route.ts` (proxies MediaMTX API) | ✅ DONE | |
| 4.13 | Design: dark theme, modern UI, animations | ✅ DONE | Dark glassmorphism, live badges |
| 4.14 | TypeScript compile check | ✅ DONE | Zero errors — `tsc --noEmit` passed |

---

### Phase 5 — Integration & Demo

| # | Task | Status | Notes |
|---|---|---|---|
| 5.1 | Run all 4 terminals simultaneously (or create single start script) | ⬜ TODO | |
| 5.2 | Login to dashboard, open Broadcast Studio | ⬜ TODO | |
| 5.3 | Start broadcast from browser, verify HLS viewer shows video | ⬜ TODO | |
| 5.3 | Verify 30s segments appear in `recordings/` folder | ⬜ TODO | |
| 5.4 | Verify upload worker sends to Supabase Storage | ⬜ TODO | |
| 5.5 | Verify recordings appear in dashboard | ⬜ TODO | |
| 5.6 | **Failover Demo**: unplug 5G ethernet → watch dashboard switch | ⬜ TODO | |
| 5.7 | Verify FailoverLog updates in real-time | ⬜ TODO | |
| 5.8 | Reconnect 5G → verify restore in FailoverLog | ⬜ TODO | |
| 5.9 | Screen record full demo for submission | ⬜ TODO | |
| 5.10 | Document results, latency metrics, screenshots for report | ⬜ TODO | |

---

## 9. Running the Project

Open **4 separate PowerShell terminals**:

**Terminal 1 — MediaMTX** (normal):
```powershell
cd "f:\Data\Yvexa\Projects\Soyza Project\mediamtx"
.\mediamtx.exe
```

**Terminal 2 — Python Monitor** (as **Administrator**):
```powershell
cd "f:\Data\Yvexa\Projects\Soyza Project\monitor"
python monitor.py
```

**Terminal 3 — Upload Worker** (normal):
```powershell
cd "f:\Data\Yvexa\Projects\Soyza Project\upload-worker"
node worker.js
```

**Terminal 4 — Next.js Dashboard** (normal):
```powershell
cd "f:\Data\Yvexa\Projects\Soyza Project\dashboard"
npm run dev
```

**Then**:
- Open browser: `http://localhost:3000`
- Log in, go to Broadcast Studio, and start the camera.

---

## 10. Testing & Validation Plan

### Test Cases

| Test ID | Test | Expected Result | Pass/Fail |
|---|---|---|---|
| T-01 | Start MediaMTX, check ports 8889/8888/9997 | Ports open, no errors | |
| T-02 | Broadcast from Browser Studio | MediaMTX logs show connection | |
| T-03 | Open `http://localhost:8888/live/stream` in browser | Video plays | |
| T-04 | Wait 30s, check `recordings/` folder | `.mp4` file appears | |
| T-05 | Upload worker detects file, uploads | File in Supabase Storage | |
| T-06 | Check Supabase `recordings` table | Row inserted correctly | |
| T-07 | Open dashboard `http://localhost:3000` | Dashboard loads with stream | |
| T-08 | `NetworkStatus` shows latency for both interfaces | Updates every 5s | |
| T-09 | **Failover**: unplug 5G ethernet cable | Monitor detects degradation | |
| T-10 | After T-09: verify routing changed to WiFi | `tracert 8.8.8.8` goes via WiFi | |
| T-11 | `FailoverLog` shows SWITCH_TO_BACKUP event | Real-time row appears | |
| T-12 | Reconnect 5G ethernet | Monitor detects recovery | |
| T-13 | `FailoverLog` shows RESTORED_PRIMARY event | Real-time row appears | |
| T-14 | Login page works with Supabase Auth | Can log in and log out | |
| T-15 | Recordings page shows all videos, playback works | Videos play in browser | |

### Performance Metrics to Capture (for Report)
- Failover detection time: target < 30 seconds
- Routing switch time after command: target < 5 seconds
- Upload time per 30s segment: measure and document
- HLS playback buffer from live: expect 5-10 seconds (normal for HLS)
- Packet loss % at failover trigger point

---

## 11. Known Constraints & Notes

### Important Warnings
1. **Python monitor MUST run as Administrator** — `Set-NetIPInterface` requires elevated privileges
2. **Supabase project pauses after 1 week of inactivity** — visit supabase.com before any demo session
3. **Supabase Storage limit is 1GB** — delete old test recordings periodically
4. **HLS has 5-10 second latency by design** — this is expected, not a bug
5. **MediaMTX API is localhost-only** — the Next.js `/api/stream-status` route proxies it server-side

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

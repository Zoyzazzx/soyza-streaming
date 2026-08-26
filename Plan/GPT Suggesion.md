a showcase/portfolio project, | would simplify 

Yes. And actually, now that I know this is the architecture a lot. 

The previous architecture | suggested is closer to something you'd deploy for a real company. For a university/final-year/showcase project, that's honestly overkill. 

Your goal should be: 

"Build something that demonstrates the complete workflow while keeping the infrastructure easy to understand." 

That's exactly what interviewers and project evaluators care about. 



## | would use something like this 

Camera / OBS | SRT / RTMP | 

MediaMTX Server || || Live Stream Recording | | ~~Lo~~ | Upload Service | Supabase Storage | Supabase Database | React / Next.js App | Supabase Authentication 

That's literally it. 

Only three main pieces. 

e Media Server e Web App e Supabase Very clean. 



Could Supabase replace lots of things? 

Absolutely. 

Instead of having 

- e PostgreSQL e Auth service e Storage e API 

You simply get 

- e ® PostgreSQL 

- e ® Authentication e ® Object Storage e @ Realtime e @ SDK e = @ Admin Dashboard 

- all inside one platform. 

For a project... 

It's honestly fantastic. 



# What each part does 

###### 1. MediaMTX 

This ONLY handles video. 

Receive stream 

L 

Broadcast 

L 

Record 

Nothing else. 



##### 2. Supabase 

Handles 



Users 

Streams 

Recordings 

Storage 

Authentication 



Basically your backend database. 

Example 

Users Table Streams Table 

Recordings Table 

Video files go into 

Storage Bucket recordings/ stream1.mp4 stream2.mp4 



3. Web App The dashboard. 

It does things like 

Login 

L Create Stream L Start Stream L Watch Live 

L 



Previous Recordings 

L 

Delete Recording 



Very simple. 



### What about the backend? 

Here's the nice part. 

You might not even need a separate backend server. 

Your web app can directly talk to Supabase. 

Browser 

L 

Supabase SDK 

L 

Database 

L 

Storage 

L 

Authentication 

For project scale, 

that's perfectly acceptable. 

If you need to do something sensitive (like generating signed upload URLs or controlling MediaMTX), you can use a few API routes in your web app. 



## Recording Upload 

This is probably the part you're wondering about. 

After MediaMTX finishes recording: 

stream0e1.mp4 

A tiny uploader script watches the recordings folder. 

New file appears 

L 

Upload to Supabase Storage 

L 

Save metadata in database 

L 

Done 

That's maybe 10 ~~0-~~ 200 lines of code. 

Very manageable. 



### Monitoring 

You don't need Prometheus and Grafana. 

Just build your own dashboard. 

For example: 



<!-- Start of picture text -->
@<br><!-- End of picture text -->

@ Live 

Bitrate 

Duration 

Current Viewers 

Recording Status 

Upload Progress 

You can get much of this from MediaMTX's API and show it in your own UI. 

It actually looks more impressive in a demo because it's your dashboard. 



##### Authentication 

Don't build it. 

Just use Supabase Auth. 

Login 

L 

JWT 

L 

Dashboard 

Done. 



### Storage 

Use Supabase Storage. 

recordings/ 

event@e1.mp4 event@@2.mp4 eventde@3 .mp4 

It already has: 

- e Upload 

- e Delete 

- e Public URLs 

- e Private buckets 

- e Signed URLs 



#### Database 

Maybe only four tables. 

Users 

Streams 

Recordings 

Devices 

That's enough. 



##### Notifications 

Supabase Realtime can notify your dashboard instantly when a stream starts, stops, ora recording finishes uploading. 



### Final architecture I'd recommend 

OBS / Camera | RTMP / SRT | MediaMTX ~~-———_~~ | | Live Stream Recording | | ~~——~~ | Upload Script | Supabase Storage | Supabase Database | React/Next.js App | Supabase Authentication 



### My recommendation for a showcase project 

If | were building this as a portfolio project, I'd use: 

- e MediaMTX = Streaming server 

- e FFmpeg - Only if you need transcoding, thumbnails, or MP4 conversion (otherwise let MediaMTX do the recording) 

- e Supabase — Authentication, PostgreSQL database, Storage, and Realtime 

- e React or Next.js — Dashboard and management interface 

- e One VPS = Runs MediaMTX (and FFmpeg if needed) 

- e One Supabase project — Everything else 

That gives you a system that's easy to explain, easy to deploy, and still demonstrates realworld concepts like live streaming, cloud recording, authentication, metadata 

management, and remote viewin ~~g—w~~ ithout the complexity of managing half a dozen infrastructure services. 

| actually think this simpler architecture makes for a better showcase because people reviewing your project can understand it in a few minutes instead of trying to follow a 

production ~~-s~~ cale distributed system. 

okay now tell me finalized services for each of these components 

-live streaming component ~~-~~ cloud storage ~~-~~ recording and encoding ~~-~~ dashboard / monitoering ~~-~~ failover control - authentication system 

Given your goal (showcase project, lowest cost, easiest possible setup, but still looks professional), this is what | would finalize. 

Component 

Service/Technology 

Why this choice 









a 

MediaMTX 









@ 

Supabase Storage 











<!-- Start of picture text -->
=<br><!-- End of picture text -->

= 

MediaMTX + FFmpeg 









fil 

Your own Web Dashboard + MediaMTX API 











=] 

Simple Auto ~~-~~ Reconnect + Docker Restart Policies 











<!-- Start of picture text -->
|<br><!-- End of picture text -->

| 

Supabase Auth 



###### Overall stack 

Frontend 

React / Next.js 



Backend 

Minimal Node.js API (only if needed) 

Streaming 

MediaMTX 

Recording 

MediaMTX + FFmpeg 

Storage 

Supabase Storage 

Database 

Supabase PostgreSQL 

Authentication 

Supabase Auth 

Monitoring 

Custom Dashboard + MediaMTX API 

Deployment 

Docker Compose 





### Why | picked these 



<!-- Start of picture text -->
=,<br><!-- End of picture text -->

=, Live Streaming ~ MediaMTX This is the heart of your project. 

It can: 

- e Receive RTMP/SRT 

- e Convert to HLS/WebRTC 

- e Serve viewers 

- e Record streams 

- e Provide APIs for status 

One application replaces what would otherwise require multiple services. 



@ Cloud Storage — Supabase Storage 

Instead of: 

e AWS S3 

e IAM 

- e Buckets 

- e Policies 

- e Credentials 

You simply: 

recordings/ 

eventé@e1.mp4 

and upload through the Supabase SDK. 

Very beginner- ~~f~~ riendly. 





<!-- Start of picture text -->
mjm<br><!-- End of picture text -->

mjm Recording - MediaMTX + FFmpeg 

MediaMTX records automatically. 

FFmpeg is only used when you want features like: 

- e Different resolutions 

- e Watermarks 

- e Thumbnail generation 

- e MP4 conversion 

- e Video clipping 

If your project only needs recording, you may barely use FFmpeg at all. 





<!-- Start of picture text -->
ff)<br><!-- End of picture text -->

ff) Dashboard 

Instead of Grafana, build your own. 

Show things like: 



<!-- Start of picture text -->
@<br><!-- End of picture text -->

@ Live 

Current viewers 

Recording status 

Duration 

Bitrate 

Recent recordings 



<mark>Storage ticsage</mark> 



This demonstrates your frontend and backend skills better than embedding Grafana. 





<!-- Start of picture text -->
®&<br><!-- End of picture text -->

###### ®& Failover 

For a project, don't overcomplicate it. 

Use: 

- e Docker restart policies ( restart: unless ~~-~~ stopped or always ) 

- e Client auto ~~-~~ reconnect 

- e Health checks in your web app (optional) 

This is enough to show resilience without building a clustered infrastructure. 





<!-- Start of picture text -->
&<br><!-- End of picture text -->

## & Authentication 

Supabase Auth gives you: 

- e Login 

- e Signup 

- e JWTs 

- e Password reset 

- ¢ Google/GitHub OAuth (if you want) 

No need for Keycloak or Authentik in a showcase project. 



## The only extra service I'd add 

One small Upload Worker. 

MediaMTX 

L 

recordings/ 

L 

Upload Worker 

L 

Supabase Storage 

L 



Its only job is: 



1. Detect when a recording finishes. 

2. Upload it to Supabase Storage. 

3. Save metadata (name, duration, size, URL) in the database. 

4. Delete the local file if desired. 

This can be a very small Nodes script. 



##### Final Architecture 

Camera / OBS | RTMP / SRT | ~~[41~~ | MediaMTx | | ~~="~~ | | Live Streaming Recording || |Upload Worker | | ~~—————~~ | Supabase Storage | Supabase Database | React/Next.js App | Supabase Auth 

###### This is the stack | would commit to 

- e @ Live Streaming: MediaMTX e ® Cloud Storage: Supabase Storage 

- e ® Recording: MediaMTX 

- e ® Encoding/Processing: FFmpeg (only when needed) 

- e @ Database: Supabase PostgreSQL 

- e @ Authentication: Supabase Auth 



<!-- Start of picture text -->
®<br><!-- End of picture text -->

- e ® Dashboard: Your own React/Next.js dashboard using the MediaMTX API and Supabase 



<!-- Start of picture text -->
®<br><!-- End of picture text -->

- e ® Monitoring: Built into your dashboard (stream status, recordings, viewers, uploads) 

e @ Failover: Docker restart policies + automatic client reconnect e @ Deployment: Docker Compose on a single VPS 

For a portfolio or academic project, this strikes a good balance between simplicity and realism. It demonstrates the core concepts of a professional live streaming platform without requiring a complex multi ~~-~~ server production environment. 






<!-- Start of picture text -->
a<br>es<br>hs<br>oo<br>—_<br>hs<br>Kingston University London<br><!-- End of picture text -->



<!-- Start of picture text -->
Kingston University London<br><!-- End of picture text -->

<mark>= = =</mark> 

## **_Abstract_** 

_This interim report presents the design of a low-cost hybrid-network prototype for live video broadcasting and cloud recording. The proposed system captures a webcam feed, encodes it for live delivery, records it in short video segments and uploads completed segments to cloud storage. Two ordinary Internet connections are used to represent a 5G link and a satellite link. A monitoring component observes network performance and selects a backup link when the active link remains below a configurable bandwidth threshold. The project is intentionally scoped as link failover rather than commercial multi-link bonding. At the interim stage, the requirements, feasibility study, system architecture, implementation plan and evaluation plan have been completed. The remaining work is to configure the streaming pipeline, automate cloud uploads, implement and test failover, and evaluate continuity, switching delay and upload reliability. The intended result is an understandable, reproducible educational prototype that demonstrates resilient live streaming without requiring specialist telecommunications equipment._ 

i 

|Contents||
|---|---|
|1. Introduction & Literature Review<br>..........................................|...............................................i|
|1.1 Introduction<br>............................................................................|...............................................i|
|1.2 Background and Motivation<br>...................................................|...............................................i|
|1.3 Problem in brief<br>......................................................................|..............................................ii|
|1.4 Aim & Objectives<br>....................................................................|..............................................ii|
|1.4.1 Aim<br>...................................................................................|..............................................ii|
|1.4.2 Objectives<br>........................................................................|..............................................ii|
|1.5 Scope<br>.....................................................................................|.............................................iii|
|1.6 Deliverables<br>...........................................................................|.............................................iii|
|1.7 Literature Review<br>...................................................................|.............................................iv|
|2. Analysis<br>.......................................................................................|..............................................v|
|3. Design<br>..........................................................................................|.............................................vi|
|3.1 Design Techniques<br>.................................................................|.............................................vi|
|3.2 System Overview<br>...................................................................|............................................vii|
|4. Product Implementation<br>...............................................................|...........................................viii|
|5. Validation<br>......................................................................................|...........................................viii|
|6. Critical Review & Conclusion<br>.......................................................|...........................................viii|



ii 

|6.1 Closing executive summary<br>..............................................|................................................viii|
|---|---|
|6.2 Conclusion<br>........................................................................|..................................................ix|
|References / Bibliography<br>..........................................................|...................................................x|
|Appendices .................................................................................|..................................................xi|



iii 

## **_List of Figures/Tables_** 

_Table 01._ 

_Requirements of the proposed system_ 

_Figure 01._ 

_Proposed Figure Secure Hybrid network Real-Time Data Streaming and Storage System_ 

_Table 02._ 

_Protocols and systems used to achieve the project_ 

_Table 3 Appendix B_ 

iv 

## **_Glossary of Terms_** 

v 

# **1. Introduction & Literature Review** 

## **1.1 Introduction** 

## **1.2 Background and Motivation** 

_I’ve been working in the television broadcast engineering field as a for almost a decade. One of the challenging tasks in the practical exercises is broadcasting and recording outdoors in rural or remote locations and  special events._ 

_Although the system that we and most organisations currently use to send data (video embedded with audio) has no cloud storage. It only capable of live streaming._ 

_The project will show the principles of hybrid connectivity, cloud uploading, live streaming and  authentication.The project uses two links. A phone hotspot or Wi-Fi service representing the 5G, while an ethernet, a second hotspot or another Wi-Fi network representing the satellite connectivity. The system rely on those two connections and switches between them depending on the signal strength or the bandwidth._ 

_Covering domains_ 

- _Network Security_ 

- _Cloud Security_ 

- _Real-Time Data communication Systems_ 

- _Data encryption_ 

- _User authentication systems_ 

i 

## **1.3 Problem in brief** 

_One of the downsides the current system is that in order to capture the video, the sender and the receiver required to be in uninterrupted realtime communication and in alert. So it requires another system for uninterrupted coordination (most off the time on cellular network for calls).  If by any mean the receiver had failed to capture the video or missed the command from the senders end , there is no way recovering the lost data since it does not provide cloud storage, nor redundancy. It could be during a live stream during an exciting moment at a sports event, it could be an important speech at a political stage or a once a lifetime moment at a wild park. Where importance of the flow of data is high._ 

## **1.4 Aim & Objectives** 

### **1.4.1 Aim** 

_The aim of this project is to design and implement a simplified hybrid 5G and satellite simulated system that captures video, provides live streaming, uploads video to cloud storage and selects a between networks when the data bandwidth is below a selected threshold._ 

### **1.4.2 Objectives** 

- _Develop video capture and encoding system using Python/ Java program._ 

- _Automatically upload the capturing video segments to a cloud storage._ 

- _Monitor two available network links and switch between routes when the active connection is below a configured threshold.._ 

- _Configuring a streaming server to receive the live feed and develop a playback_ 

- _Making a cloud upload method which Splits recordings into short video files then automatically uploads completed files to a cloud storage._ 

ii 

## **1.5 Scope** 

_The project uses a webcam source as the video input, two Internet links representing 5G and satellite connection to switch between depending on the connection bandwidth. Video quality with 720p for a low bitrate suitable for the project._ 

_HTTP/HLS Live Streaming is used for  playback, because it transfers an ongoing multimedia session as segments. It allows the network to send the data seamlessly and allows to live stream to start without waiting for the whole session to be complete. Also it helps to reduce data traffic and redundancy since it sends small segments instead of sending a huge bulk of data._ 

_A buffer time will be introduced (around 5ms) so it gives time for the processing time and to resend segments if any is missing._ 

## **1.6 Deliverables** 

_A Secure Hybrid network Real-Time Data Streaming and Storage System that is capable of live streaming and cloud uploading in real time. The system will be connected to two networks where switching between them will be dependent on the bandwidth either connections._ 

_Test and result documentation will be included. It contains test plan and test cases, screenshots, logs, and results along with video evidence._ 

_Java/Python scripts used  for monitoring, switching and  uploading._ 

_Dashboard will include active network connection status, Bandwidth and latency status and live streaming conditions for playback._ 

_An automated cloud upload component. Split the captured video into segments while maintaining a log for upload success or failure details._ 

iii 

## **1.7 Literature Review** 

_Live video streaming and broadcasting requires the continuous capture, encoding, uninterrupted transmission and delivery of video to viewers/receivers. A major challenge is that live video quality heavily depends on the availability and the quality  network connection used. When facing low bandwidth, the stream may buffer or disconnect due to high latency. This is especially important for TV broadcasting, live streamers,, journalists, event organisers and so on. It is an advantage relying on more than one stable Internet connection._ 

_Commercial systems that is broadly used in Sri Lanka such as LiveU LU800 provide seamless service is a benchmark for same level systems. LiveU system bonds multiple cellular, connections to create a more strong uplink.. These systems demonstrate the value of multiple connections  for live broadcasting and live streaming. Their main tactical is traffic can use multiple links, which reduces dependence on a single mobile network. Although these systems does not upload to a cloud or contain redundancy. Also continuous coordination between two ends is requited for video capturing and for a successful session. Therefor the proposed system contains these missing advantages from the current system._ 

_At the streaming layer, RTMP, HLS were considered as in RTMP acts as an ingest protocol because it enables the field application to send a continuous encoded video feed to a streaming server. HLS will be used for viewer delivery because it uses a playlist containing sequential media segments, allowing a browser to play an ongoing stream. Its advantage is broad compatibility with web delivery. For this project, reliability and browser access are important. Therefore, HLS is selected for playback.FFmpeg was selected as the main media-processing technology because it  supports encoding, RTMP output and HLS/segment generation._ 

_There for in the final design  webcam feed will be encoded by FFmpeg, sent to a streaming server using RTMP, delivered to viewers through HLS, recorded in short segments, uploaded to cloud storage and controlled by Python based  monitoring._ 

iv 

# **2. Analysis** 

_The analysis recognised that a single network live streaming/broadcasting setup low bandwidth and high latency. It also identified the risk of losing video data when it only streams video without any redundancy concerns and has no cloud uploading method._ 

_The proposed solution uses two Internet connections representing  a 5G and a satellite link. The system monitors the active connection and switches to the secondary connection when the active link reach below a defined threshold. At the same time, it splits the video data into segments and uploads those segments to cloud storage._ 

_Table 01. Requirements of the proposed system_ 

|**_Requirement_**|**_Priority_**|**_Use_**|
|---|---|---|
|_Capture video from an_<br>_attached webcam._|_Must_|_A preview and encoded_<br>_video feed are produced._|
|_Send live video to the_<br>_streaming server._|_Must_|_A viewer can open the live_<br>_channel in a browser._|
|_Create short recordings and_<br>_upload them automatically._|_Must_|_Completed segments_<br>_appear in cloud storage._|
|_Monitor both simulated_<br>_links._|_Must_|_Measurements and active-_<br>_link state are logged._|
|_Fail over below a defined_<br>_threshold._|_Must_|_The preferred link changes_<br>_after sustained degradation._|



v 

# **3. Design** 

## **3.1 Design Techniques** 

_The design has each segments where each carry responsibilities such as capture and encoding, streaming, segmentation, cloud upload, link measurement, decision making and status display._ 

#### _Figure 01._ 

_Proposed Figure Secure Hybrid network Real-Time Data Streaming and Storage System_ 



<!-- Start of picture text -->
Optimal   Live Streaming<br>Network<br>5G or Satellite  HLS Playback<br>Webcam  API<br>Capturing, encoding,<br>network monitoring,<br>Live video input<br>Failover<br>Cloud Storage<br>Secondary<br>Network<br>Segment based video<br>Segment recording  Archive<br><!-- End of picture text -->

vi 

## **3.2 System Overview** 

_The switching algorithm has a simple rule, measure the quality and the bandwidth of the stream. If the active connection goes below the threshold and the backup score is acceptable, change the network route and restart/continue the stream with the reliable path._ 

_The dashboard will show the active link, latest measurements, threshold, streaming status, latest cloud upload and failover count. This dashboard is not a full network management type tool. it simply provides details and data  for demonstration._ 

#### _Table 02._ 

_Protocols and systems used to achieve the project._ 

|**Protocol / system**|**UUse**|
|---|---|
|HTTP|Transfers the HLS playlist and video segments from the<br>streaming server to viewers.|
|HLS|Delivers the live stream from the server to viewers in a web<br>browser. It uses short video segments.|
|HTTPS|Used for the dashboard and cloud uploads.|
|ICMP/ Ping|Checks the network connection’s reachable and measures<br>latency so themonitoring script can use it.|
|IPv4/ IPv6|The operating system uses these routing rules to choose<br>which network connection is the best path|
|Wifi and Ethernet|One local connection simulating the 5G connection and one<br>wired connection simulating satellite connection.|
|RTMP|carries the live video feed from the sender to the streaming<br>platform in real time.|
|Pithon|Acts as the main controller of the system for decision<br>making and coordinating.|
|MediaMTX + FFmpeg|For capturing, converting, compressing, recording and for<br>routing.|



vii 

# **4. Product Implementation** 

_Technical description of implementation: use of libraries and interfaces; functions used; application of coding principles; critical discussion of coding issues; sophistication of code; code structure; choice of methodologies; modularity_ 

# **5. Validation** 

_Strategies and outcomes: Clear test strategy; testing framework; evaluation analysis; usability testing; performance testing; black box / white box; functionality; feedback from client_ 

# **6. Critical Review & Conclusion** 

## **6.1 Closing executive summary** 

_The interim review shows that the proposed project is feasible if it remains a failover prototype. The design uses accessible tools while still addressing a meaningful networking problem: maintaining video service and preserving recordings when a preferred link degrades. The most important scope decision is to avoid promising commercial-grade bonding or seamless handover. This keeps the evaluation credible and gives the project a welldefined contribution._ 

viii 

## **6.2 Conclusion** 

_This interim report presented the proposed design for a hybrid 5G–satellite simulated system for live video streaming and cloud recording. The project addresses the problem of unreliable live broadcasting when a device depends on one Internet connection. The proposed solution uses two ordinary Internet connections to represent 5G and satellite links, monitors their performance, and changes to a backup connection when the active link remains below a defined threshold._ 

_The project aim is to develop a simplified system that captures webcam video, streams it live, records it in segments, uploads recordings to cloud storage and performs automatic network failover. At the interim stage, the aim has been achieved at the planning and design level. The project problem has been defined, relevant technologies have been reviewed, requirements have been identified, the system architecture has been designed, and an implementation and validation plan has been produced._ 

_Future work could improve the system by implementing Multipath TCP or other multi-path technologies, adding adaptive bitrate streaming, using Secure Reliable Transport, improving dashboard features, encrypting recordings end-to-end and testing with real 5G or satellite Internet services. A mobile application and support for multiple cameras could also be investigated in future._ 

ix 

# **References / Bibliography** 

_Here you should give details of citations that you have used in the text. An entry in list of reference generally includes information such as Author, Year, Title of the Article, Name of Journal/conference, page numbers. There are various reference and citation styles, but you should use the one shown in the sample._ 

x 

# **Appendices** 

## **Appendix A – Proposed System Requirements** 

_Hardware requirements_ 

- _Laptop or desktop computer_ 

- _Built-in or USB webcam_ 

- _Two Internet connections:_ 

   - _Mobile hotspot/Wi-Fi to simulate 5G_ 

   - _Ethernet, second Wi-Fi, or second hotspot to simulate satellite_ 

- _Optional external microphone_ 

_Software requirements_ 

- _Python_ 

- _FFmpeg_ 

- _Nginx with RTMP support_ 

- _Flask dashboard_ 

- _AWS account and S3 bucket_ 

- _Web browser_ 

xi 

### _Table 3 Appendix B_ 

|_Task_|_Status at interim_<br>_stage_|
|---|---|
|_Define project problem and objectives _|_Completed_|
|_Literature review_|_Completed_|
|_Requirement analysis_|_Completed_|
|_System architecture design_|_Completed_|
|_Set up Python and development_<br>_environment_|_Planned_|
|_Implement webcam capture_|_Planned_|
|_Configure FFmpeg and streaming_<br>_server_|_Planned_|
|_Implement cloud upload_|_Planned_|
|_Implement network monitoring_|_Planned_|
|_Implement automatic failover_|_Planned_|
|_Testing and evaluation_|_Planned_|
|_Final report and presentation_|_Planned_|



xii 


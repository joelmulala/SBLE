-- SBLE Seed Data
-- 15 admins, 15 lecturers, 15 students + courses, enrollments,
-- assignments, quizzes, quiz questions, exams, rooms
-- Run: psql -U postgres -d sble -f seed.sql

BEGIN;

TRUNCATE TABLE
  audit_logs,
  rooms,
  exams,
  quiz_attempts,
  quiz_questions,
  quizzes,
  submissions,
  assignments,
  materials,
  enrollments,
  courses,
  users
RESTART IDENTITY CASCADE;

-- ─── ADMINS (15) ─────────────────────────────────────────────────────────────
INSERT INTO users (id, email, full_name, role) VALUES
('a0000001-0000-0000-0000-000000000001','admin1@sble.local','James Doe','admin'),
('a0000001-0000-0000-0000-000000000002','admin2@sble.local','Jane Doe','admin'),
('a0000001-0000-0000-0000-000000000003','admin3@sble.local','Jordan Doe','admin'),
('a0000001-0000-0000-0000-000000000004','admin4@sble.local','Jamie Doe','admin'),
('a0000001-0000-0000-0000-000000000005','admin5@sble.local','Jesse Doe','admin'),
('a0000001-0000-0000-0000-000000000006','admin6@sble.local','Jules Doe','admin'),
('a0000001-0000-0000-0000-000000000007','admin7@sble.local','Jade Doe','admin'),
('a0000001-0000-0000-0000-000000000008','admin8@sble.local','Jasper Doe','admin'),
('a0000001-0000-0000-0000-000000000009','admin9@sble.local','Juno Doe','admin'),
('a0000001-0000-0000-0000-000000000010','admin10@sble.local','Jett Doe','admin'),
('a0000001-0000-0000-0000-000000000011','admin11@sble.local','Jada Doe','admin'),
('a0000001-0000-0000-0000-000000000012','admin12@sble.local','Jax Doe','admin'),
('a0000001-0000-0000-0000-000000000013','admin13@sble.local','Joelle Doe','admin'),
('a0000001-0000-0000-0000-000000000014','admin14@sble.local','Jared Doe','admin'),
('a0000001-0000-0000-0000-000000000015','admin15@sble.local','Jolene Doe','admin');

-- ─── LECTURERS (15) ──────────────────────────────────────────────────────────
INSERT INTO users (id, email, full_name, role) VALUES
('l0000001-0000-0000-0000-000000000001','lecturer1@sble.local','Dr. Alice Doe','lecturer'),
('l0000001-0000-0000-0000-000000000002','lecturer2@sble.local','Dr. Brian Doe','lecturer'),
('l0000001-0000-0000-0000-000000000003','lecturer3@sble.local','Dr. Clara Doe','lecturer'),
('l0000001-0000-0000-0000-000000000004','lecturer4@sble.local','Dr. David Doe','lecturer'),
('l0000001-0000-0000-0000-000000000005','lecturer5@sble.local','Dr. Elena Doe','lecturer'),
('l0000001-0000-0000-0000-000000000006','lecturer6@sble.local','Dr. Frank Doe','lecturer'),
('l0000001-0000-0000-0000-000000000007','lecturer7@sble.local','Dr. Grace Doe','lecturer'),
('l0000001-0000-0000-0000-000000000008','lecturer8@sble.local','Dr. Henry Doe','lecturer'),
('l0000001-0000-0000-0000-000000000009','lecturer9@sble.local','Dr. Irene Doe','lecturer'),
('l0000001-0000-0000-0000-000000000010','lecturer10@sble.local','Dr. Jack Doe','lecturer'),
('l0000001-0000-0000-0000-000000000011','lecturer11@sble.local','Dr. Karen Doe','lecturer'),
('l0000001-0000-0000-0000-000000000012','lecturer12@sble.local','Dr. Leo Doe','lecturer'),
('l0000001-0000-0000-0000-000000000013','lecturer13@sble.local','Dr. Maya Doe','lecturer'),
('l0000001-0000-0000-0000-000000000014','lecturer14@sble.local','Dr. Nathan Doe','lecturer'),
('l0000001-0000-0000-0000-000000000015','lecturer15@sble.local','Dr. Olivia Doe','lecturer');

-- ─── STUDENTS (15) ───────────────────────────────────────────────────────────
INSERT INTO users (id, email, full_name, role) VALUES
('s0000001-0000-0000-0000-000000000001','student1@sble.local','Aaron Doe','student'),
('s0000001-0000-0000-0000-000000000002','student2@sble.local','Beth Doe','student'),
('s0000001-0000-0000-0000-000000000003','student3@sble.local','Carlos Doe','student'),
('s0000001-0000-0000-0000-000000000004','student4@sble.local','Diana Doe','student'),
('s0000001-0000-0000-0000-000000000005','student5@sble.local','Ethan Doe','student'),
('s0000001-0000-0000-0000-000000000006','student6@sble.local','Fatima Doe','student'),
('s0000001-0000-0000-0000-000000000007','student7@sble.local','George Doe','student'),
('s0000001-0000-0000-0000-000000000008','student8@sble.local','Hannah Doe','student'),
('s0000001-0000-0000-0000-000000000009','student9@sble.local','Ivan Doe','student'),
('s0000001-0000-0000-0000-000000000010','student10@sble.local','Julia Doe','student'),
('s0000001-0000-0000-0000-000000000011','student11@sble.local','Kevin Doe','student'),
('s0000001-0000-0000-0000-000000000012','student12@sble.local','Laura Doe','student'),
('s0000001-0000-0000-0000-000000000013','student13@sble.local','Marcus Doe','student'),
('s0000001-0000-0000-0000-000000000014','student14@sble.local','Nina Doe','student'),
('s0000001-0000-0000-0000-000000000015','student15@sble.local','Oscar Doe','student');

-- ─── COURSES (15 — one per lecturer) ─────────────────────────────────────────
INSERT INTO courses (id, title, description, lecturer_id) VALUES
(1,'Introduction to Cybersecurity','Fundamentals of information security, threats, and defences.','l0000001-0000-0000-0000-000000000001'),
(2,'Web Application Development','Building secure, modern web applications with React and Node.js.','l0000001-0000-0000-0000-000000000002'),
(3,'Database Systems','Relational database design, SQL, and query optimisation.','l0000001-0000-0000-0000-000000000003'),
(4,'Operating Systems','Process management, memory, file systems, and security.','l0000001-0000-0000-0000-000000000004'),
(5,'Computer Networks','TCP/IP, routing, switching, and network security protocols.','l0000001-0000-0000-0000-000000000005'),
(6,'Software Engineering','SDLC, agile methods, design patterns, and testing.','l0000001-0000-0000-0000-000000000006'),
(7,'Artificial Intelligence','Search algorithms, machine learning, and neural networks.','l0000001-0000-0000-0000-000000000007'),
(8,'Data Structures and Algorithms','Arrays, trees, graphs, sorting, and complexity analysis.','l0000001-0000-0000-0000-000000000008'),
(9,'Cloud Computing','Virtualisation, IaaS, PaaS, SaaS, and cloud security.','l0000001-0000-0000-0000-000000000009'),
(10,'Mobile Application Development','Cross-platform mobile development and security considerations.','l0000001-0000-0000-0000-000000000010'),
(11,'Digital Forensics','Evidence acquisition, analysis, and chain of custody.','l0000001-0000-0000-0000-000000000011'),
(12,'Cryptography','Symmetric, asymmetric encryption, hashing, and PKI.','l0000001-0000-0000-0000-000000000012'),
(13,'Human-Computer Interaction','UX design, usability testing, and accessibility.','l0000001-0000-0000-0000-000000000013'),
(14,'Ethical Hacking','Penetration testing methodologies and vulnerability assessment.','l0000001-0000-0000-0000-000000000014'),
(15,'Research Methods in Computing','Academic writing, research design, and data analysis.','l0000001-0000-0000-0000-000000000015');

-- ─── ENROLLMENTS (each student enrolled in 5 courses) ────────────────────────
INSERT INTO enrollments (course_id, student_id) VALUES
(1,'s0000001-0000-0000-0000-000000000001'),(2,'s0000001-0000-0000-0000-000000000001'),
(3,'s0000001-0000-0000-0000-000000000001'),(4,'s0000001-0000-0000-0000-000000000001'),
(5,'s0000001-0000-0000-0000-000000000001'),
(1,'s0000001-0000-0000-0000-000000000002'),(2,'s0000001-0000-0000-0000-000000000002'),
(6,'s0000001-0000-0000-0000-000000000002'),(7,'s0000001-0000-0000-0000-000000000002'),
(8,'s0000001-0000-0000-0000-000000000002'),
(3,'s0000001-0000-0000-0000-000000000003'),(4,'s0000001-0000-0000-0000-000000000003'),
(9,'s0000001-0000-0000-0000-000000000003'),(10,'s0000001-0000-0000-0000-000000000003'),
(11,'s0000001-0000-0000-0000-000000000003'),
(5,'s0000001-0000-0000-0000-000000000004'),(6,'s0000001-0000-0000-0000-000000000004'),
(12,'s0000001-0000-0000-0000-000000000004'),(13,'s0000001-0000-0000-0000-000000000004'),
(14,'s0000001-0000-0000-0000-000000000004'),
(7,'s0000001-0000-0000-0000-000000000005'),(8,'s0000001-0000-0000-0000-000000000005'),
(15,'s0000001-0000-0000-0000-000000000005'),(1,'s0000001-0000-0000-0000-000000000005'),
(2,'s0000001-0000-0000-0000-000000000005'),
(9,'s0000001-0000-0000-0000-000000000006'),(10,'s0000001-0000-0000-0000-000000000006'),
(3,'s0000001-0000-0000-0000-000000000006'),(4,'s0000001-0000-0000-0000-000000000006'),
(5,'s0000001-0000-0000-0000-000000000006'),
(11,'s0000001-0000-0000-0000-000000000007'),(12,'s0000001-0000-0000-0000-000000000007'),
(6,'s0000001-0000-0000-0000-000000000007'),(7,'s0000001-0000-0000-0000-000000000007'),
(8,'s0000001-0000-0000-0000-000000000007'),
(13,'s0000001-0000-0000-0000-000000000008'),(14,'s0000001-0000-0000-0000-000000000008'),
(9,'s0000001-0000-0000-0000-000000000008'),(10,'s0000001-0000-0000-0000-000000000008'),
(11,'s0000001-0000-0000-0000-000000000008'),
(15,'s0000001-0000-0000-0000-000000000009'),(1,'s0000001-0000-0000-0000-000000000009'),
(12,'s0000001-0000-0000-0000-000000000009'),(13,'s0000001-0000-0000-0000-000000000009'),
(14,'s0000001-0000-0000-0000-000000000009'),
(2,'s0000001-0000-0000-0000-000000000010'),(3,'s0000001-0000-0000-0000-000000000010'),
(15,'s0000001-0000-0000-0000-000000000010'),(4,'s0000001-0000-0000-0000-000000000010'),
(5,'s0000001-0000-0000-0000-000000000010'),
(6,'s0000001-0000-0000-0000-000000000011'),(7,'s0000001-0000-0000-0000-000000000011'),
(8,'s0000001-0000-0000-0000-000000000011'),(9,'s0000001-0000-0000-0000-000000000011'),
(10,'s0000001-0000-0000-0000-000000000011'),
(11,'s0000001-0000-0000-0000-000000000012'),(12,'s0000001-0000-0000-0000-000000000012'),
(13,'s0000001-0000-0000-0000-000000000012'),(14,'s0000001-0000-0000-0000-000000000012'),
(15,'s0000001-0000-0000-0000-000000000012'),
(1,'s0000001-0000-0000-0000-000000000013'),(3,'s0000001-0000-0000-0000-000000000013'),
(5,'s0000001-0000-0000-0000-000000000013'),(7,'s0000001-0000-0000-0000-000000000013'),
(9,'s0000001-0000-0000-0000-000000000013'),
(2,'s0000001-0000-0000-0000-000000000014'),(4,'s0000001-0000-0000-0000-000000000014'),
(6,'s0000001-0000-0000-0000-000000000014'),(8,'s0000001-0000-0000-0000-000000000014'),
(10,'s0000001-0000-0000-0000-000000000014'),
(11,'s0000001-0000-0000-0000-000000000015'),(13,'s0000001-0000-0000-0000-000000000015'),
(14,'s0000001-0000-0000-0000-000000000015'),(15,'s0000001-0000-0000-0000-000000000015'),
(12,'s0000001-0000-0000-0000-000000000015');

-- ─── ASSIGNMENTS (2 per course, 30 total) ────────────────────────────────────
INSERT INTO assignments (course_id, title, description, due_date, allows_handwritten, created_by) VALUES
(1,'Security Threat Analysis','Identify and analyse three real-world cybersecurity threats.','2026-05-10 23:59:00',TRUE,'l0000001-0000-0000-0000-000000000001'),
(1,'Firewall Configuration Report','Document a firewall rule set for a small business network.','2026-05-24 23:59:00',TRUE,'l0000001-0000-0000-0000-000000000001'),
(2,'React Component Design','Build a reusable authenticated component using React and Keycloak.','2026-05-12 23:59:00',FALSE,'l0000001-0000-0000-0000-000000000002'),
(2,'REST API Implementation','Implement a secure REST API with Express and JWT.','2026-05-26 23:59:00',FALSE,'l0000001-0000-0000-0000-000000000002'),
(3,'ER Diagram Design','Design a normalised ER diagram for a university system.','2026-05-08 23:59:00',TRUE,'l0000001-0000-0000-0000-000000000003'),
(3,'SQL Query Optimisation','Write and optimise 10 complex SQL queries.','2026-05-22 23:59:00',FALSE,'l0000001-0000-0000-0000-000000000003'),
(4,'Process Scheduling Simulation','Simulate FCFS and Round Robin scheduling algorithms.','2026-05-14 23:59:00',FALSE,'l0000001-0000-0000-0000-000000000004'),
(4,'Memory Management Essay','Compare paging and segmentation memory management.','2026-05-28 23:59:00',TRUE,'l0000001-0000-0000-0000-000000000004'),
(5,'Network Topology Design','Design a secure network topology for a campus.','2026-05-09 23:59:00',TRUE,'l0000001-0000-0000-0000-000000000005'),
(5,'Packet Analysis Report','Analyse a provided PCAP file and identify anomalies.','2026-05-23 23:59:00',FALSE,'l0000001-0000-0000-0000-000000000005'),
(6,'Agile Sprint Plan','Create a sprint plan for a software project using Scrum.','2026-05-11 23:59:00',TRUE,'l0000001-0000-0000-0000-000000000006'),
(6,'Design Patterns Report','Explain and implement three GoF design patterns.','2026-05-25 23:59:00',FALSE,'l0000001-0000-0000-0000-000000000006'),
(7,'Search Algorithm Implementation','Implement A* and compare with BFS and DFS.','2026-05-13 23:59:00',FALSE,'l0000001-0000-0000-0000-000000000007'),
(7,'ML Model Evaluation','Train and evaluate a classification model on a dataset.','2026-05-27 23:59:00',FALSE,'l0000001-0000-0000-0000-000000000007'),
(8,'Sorting Algorithm Analysis','Implement and benchmark five sorting algorithms.','2026-05-07 23:59:00',FALSE,'l0000001-0000-0000-0000-000000000008'),
(8,'Graph Traversal Report','Implement BFS and DFS and analyse time complexity.','2026-05-21 23:59:00',FALSE,'l0000001-0000-0000-0000-000000000008'),
(9,'Cloud Architecture Design','Design a scalable cloud architecture for an LMS.','2026-05-15 23:59:00',TRUE,'l0000001-0000-0000-0000-000000000009'),
(9,'Serverless Function Implementation','Deploy a serverless function and document the process.','2026-05-29 23:59:00',FALSE,'l0000001-0000-0000-0000-000000000009'),
(10,'Mobile UI Prototype','Design and prototype a mobile app UI for SBLE.','2026-05-10 23:59:00',TRUE,'l0000001-0000-0000-0000-000000000010'),
(10,'Cross-Platform Security Review','Review security considerations for React Native apps.','2026-05-24 23:59:00',TRUE,'l0000001-0000-0000-0000-000000000010'),
(11,'Forensic Investigation Report','Conduct a mock forensic investigation on provided evidence.','2026-05-12 23:59:00',TRUE,'l0000001-0000-0000-0000-000000000011'),
(11,'Chain of Custody Documentation','Document a complete chain of custody for digital evidence.','2026-05-26 23:59:00',TRUE,'l0000001-0000-0000-0000-000000000011'),
(12,'RSA Encryption Implementation','Implement RSA encryption and decryption from scratch.','2026-05-08 23:59:00',FALSE,'l0000001-0000-0000-0000-000000000012'),
(12,'Hash Function Analysis','Compare MD5, SHA-1, and SHA-256 with collision examples.','2026-05-22 23:59:00',FALSE,'l0000001-0000-0000-0000-000000000012'),
(13,'Usability Test Report','Conduct a usability test on an existing web application.','2026-05-14 23:59:00',TRUE,'l0000001-0000-0000-0000-000000000013'),
(13,'Accessibility Audit','Audit a website for WCAG 2.1 compliance.','2026-05-28 23:59:00',TRUE,'l0000001-0000-0000-0000-000000000013'),
(14,'Penetration Test Report','Perform a penetration test on a provided test environment.','2026-05-09 23:59:00',TRUE,'l0000001-0000-0000-0000-000000000014'),
(14,'Vulnerability Assessment','Identify and document vulnerabilities in a sample application.','2026-05-23 23:59:00',TRUE,'l0000001-0000-0000-0000-000000000014'),
(15,'Research Proposal','Write a 1500-word research proposal on a computing topic.','2026-05-11 23:59:00',TRUE,'l0000001-0000-0000-0000-000000000015'),
(15,'Literature Review','Conduct a literature review on blended learning security.','2026-05-25 23:59:00',TRUE,'l0000001-0000-0000-0000-000000000015');

-- ─── QUIZZES (1 published per course, 15 total) ───────────────────────────────
INSERT INTO quizzes (id, course_id, title, time_limit_minutes, is_published, created_by) VALUES
(1,1,'Cybersecurity Fundamentals Quiz',20,TRUE,'l0000001-0000-0000-0000-000000000001'),
(2,2,'Web Development Concepts Quiz',25,TRUE,'l0000001-0000-0000-0000-000000000002'),
(3,3,'Database Design Quiz',20,TRUE,'l0000001-0000-0000-0000-000000000003'),
(4,4,'Operating Systems Quiz',30,TRUE,'l0000001-0000-0000-0000-000000000004'),
(5,5,'Networking Protocols Quiz',25,TRUE,'l0000001-0000-0000-0000-000000000005'),
(6,6,'Software Engineering Quiz',20,TRUE,'l0000001-0000-0000-0000-000000000006'),
(7,7,'AI Concepts Quiz',30,TRUE,'l0000001-0000-0000-0000-000000000007'),
(8,8,'Algorithms Quiz',25,TRUE,'l0000001-0000-0000-0000-000000000008'),
(9,9,'Cloud Computing Quiz',20,TRUE,'l0000001-0000-0000-0000-000000000009'),
(10,10,'Mobile Development Quiz',20,TRUE,'l0000001-0000-0000-0000-000000000010'),
(11,11,'Digital Forensics Quiz',25,TRUE,'l0000001-0000-0000-0000-000000000011'),
(12,12,'Cryptography Quiz',30,TRUE,'l0000001-0000-0000-0000-000000000012'),
(13,13,'HCI Principles Quiz',20,TRUE,'l0000001-0000-0000-0000-000000000013'),
(14,14,'Ethical Hacking Quiz',25,TRUE,'l0000001-0000-0000-0000-000000000014'),
(15,15,'Research Methods Quiz',20,TRUE,'l0000001-0000-0000-0000-000000000015');

-- ─── QUIZ QUESTIONS (3 per quiz, 45 total) ───────────────────────────────────
INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, marks) VALUES
-- Quiz 1: Cybersecurity
(1,'What does CIA stand for in cybersecurity?','mcq','["Confidentiality, Integrity, Availability","Control, Integrity, Access","Confidentiality, Identity, Access","Cyber, Intelligence, Assurance"]','Confidentiality, Integrity, Availability',2),
(1,'A firewall operates at which layer of the OSI model?','mcq','["Layer 3 and 4","Layer 1","Layer 7 only","Layer 2 only"]','Layer 3 and 4',1),
(1,'Encryption protects data confidentiality.','true_false',NULL,'True',1),
-- Quiz 2: Web Development
(2,'Which HTTP method is used to update a resource?','mcq','["PUT","GET","DELETE","HEAD"]','PUT',1),
(2,'React uses a virtual DOM to improve performance.','true_false',NULL,'True',1),
(2,'What does REST stand for?','mcq','["Representational State Transfer","Remote Execution Standard Transfer","Resource Endpoint State Transfer","Representational Endpoint Standard Transfer"]','Representational State Transfer',2),
-- Quiz 3: Database
(3,'Which SQL clause filters grouped results?','mcq','["HAVING","WHERE","GROUP BY","ORDER BY"]','HAVING',1),
(3,'A primary key can contain NULL values.','true_false',NULL,'False',1),
(3,'What is the purpose of database normalisation?','mcq','["Reduce redundancy and improve integrity","Increase data duplication","Speed up all queries","Encrypt stored data"]','Reduce redundancy and improve integrity',2),
-- Quiz 4: Operating Systems
(4,'Which scheduling algorithm can cause starvation?','mcq','["Priority Scheduling","Round Robin","FCFS","Shortest Job First"]','Priority Scheduling',1),
(4,'Virtual memory allows programs to use more memory than physically available.','true_false',NULL,'True',1),
(4,'What is a deadlock?','mcq','["Two processes waiting on each other indefinitely","A process using 100% CPU","Memory overflow","A network timeout"]','Two processes waiting on each other indefinitely',2),
-- Quiz 5: Networking
(5,'What does DNS stand for?','mcq','["Domain Name System","Data Network Service","Dynamic Name Server","Distributed Network System"]','Domain Name System',1),
(5,'TCP is a connectionless protocol.','true_false',NULL,'False',1),
(5,'Which port does HTTPS use by default?','mcq','["443","80","8080","22"]','443',2),
-- Quiz 6: Software Engineering
(6,'Which agile ceremony reviews completed work with stakeholders?','mcq','["Sprint Review","Daily Standup","Sprint Planning","Retrospective"]','Sprint Review',1),
(6,'The Waterfall model allows going back to previous phases easily.','true_false',NULL,'False',1),
(6,'What does SOLID stand for in software design?','mcq','["Single responsibility, Open-closed, Liskov, Interface segregation, Dependency inversion","Simple, Open, Linked, Integrated, Dynamic","Structured, Object, Linked, Interface, Design","None of the above"]','Single responsibility, Open-closed, Liskov, Interface segregation, Dependency inversion',2),
-- Quiz 7: AI
(7,'Which search algorithm uses a heuristic function?','mcq','["A*","BFS","DFS","Dijkstra"]','A*',1),
(7,'A neural network with no hidden layers is called a perceptron.','true_false',NULL,'True',1),
(7,'What is overfitting in machine learning?','mcq','["Model performs well on training data but poorly on new data","Model performs poorly on all data","Model trains too slowly","Model uses too little data"]','Model performs well on training data but poorly on new data',2),
-- Quiz 8: Algorithms
(8,'What is the time complexity of binary search?','mcq','["O(log n)","O(n)","O(n²)","O(1)"]','O(log n)',1),
(8,'Quicksort has a worst-case time complexity of O(n²).','true_false',NULL,'True',1),
(8,'Which data structure uses LIFO order?','mcq','["Stack","Queue","Heap","Graph"]','Stack',2),
-- Quiz 9: Cloud
(9,'What does IaaS stand for?','mcq','["Infrastructure as a Service","Internet as a Service","Integration as a Service","Interface as a Service"]','Infrastructure as a Service',1),
(9,'Serverless computing means there are no servers involved.','true_false',NULL,'False',1),
(9,'Which cloud model is shared between organisations with similar needs?','mcq','["Community Cloud","Public Cloud","Private Cloud","Hybrid Cloud"]','Community Cloud',2),
-- Quiz 10: Mobile
(10,'React Native compiles to native code.','true_false',NULL,'True',1),
(10,'Which storage option persists data after app restart on mobile?','mcq','["AsyncStorage","State","Props","Context"]','AsyncStorage',1),
(10,'What is the purpose of a mobile API gateway?','mcq','["Manage and secure API calls from mobile clients","Store mobile app data","Render mobile UI","Handle push notifications only"]','Manage and secure API calls from mobile clients',2),
-- Quiz 11: Forensics
(11,'What is the first step in digital forensics?','mcq','["Evidence acquisition","Analysis","Reporting","Presentation"]','Evidence acquisition',1),
(11,'Modifying evidence during acquisition is acceptable if documented.','true_false',NULL,'False',1),
(11,'What does a write blocker do?','mcq','["Prevents writing to evidence media","Blocks network writes","Encrypts evidence","Compresses forensic images"]','Prevents writing to evidence media',2),
-- Quiz 12: Cryptography
(12,'AES stands for Advanced Encryption Standard.','true_false',NULL,'True',1),
(12,'Which key size does AES-256 use?','mcq','["256 bits","128 bits","512 bits","64 bits"]','256 bits',1),
(12,'What is the purpose of a salt in password hashing?','mcq','["Prevent rainbow table attacks","Speed up hashing","Encrypt the password","Compress the hash"]','Prevent rainbow table attacks',2),
-- Quiz 13: HCI
(13,'What does WCAG stand for?','mcq','["Web Content Accessibility Guidelines","Web Coding and Graphics","Website Compliance and Governance","Web Component Architecture Guide"]','Web Content Accessibility Guidelines',1),
(13,'A higher Fitts Law index of difficulty means a target is easier to click.','true_false',NULL,'False',1),
(13,'Which usability metric measures how quickly users complete a task?','mcq','["Efficiency","Learnability","Memorability","Satisfaction"]','Efficiency',2),
-- Quiz 14: Ethical Hacking
(14,'What is a zero-day vulnerability?','mcq','["Unknown vulnerability with no available patch","A vulnerability fixed in zero days","A network attack","A type of malware"]','Unknown vulnerability with no available patch',1),
(14,'Ethical hacking requires written permission from the target organisation.','true_false',NULL,'True',1),
(14,'Which tool is commonly used for network scanning?','mcq','["Nmap","Photoshop","Excel","Git"]','Nmap',2),
-- Quiz 15: Research Methods
(15,'What is a literature review?','mcq','["A critical summary of existing research on a topic","A list of books","A research experiment","A data collection method"]','A critical summary of existing research on a topic',1),
(15,'Qualitative research deals primarily with numerical data.','true_false',NULL,'False',1),
(15,'What does APA stand for in academic referencing?','mcq','["American Psychological Association","Academic Publishing Authority","Applied Psychology Association","Academic Peer Assessment"]','American Psychological Association',2);

-- ─── EXAMS (1 per course, all locked — lecturer releases manually) ────────────
INSERT INTO exams (course_id, title, scheduled_at, duration_minutes, is_released, file_path, created_by) VALUES
(1,'Cybersecurity Final Exam','2026-06-10 09:00:00',120,FALSE,'uploads/exams/placeholder.enc','l0000001-0000-0000-0000-000000000001'),
(2,'Web Development Final Exam','2026-06-11 09:00:00',120,FALSE,'uploads/exams/placeholder.enc','l0000001-0000-0000-0000-000000000002'),
(3,'Database Systems Final Exam','2026-06-12 09:00:00',120,FALSE,'uploads/exams/placeholder.enc','l0000001-0000-0000-0000-000000000003'),
(4,'Operating Systems Final Exam','2026-06-13 09:00:00',120,FALSE,'uploads/exams/placeholder.enc','l0000001-0000-0000-0000-000000000004'),
(5,'Computer Networks Final Exam','2026-06-14 09:00:00',120,FALSE,'uploads/exams/placeholder.enc','l0000001-0000-0000-0000-000000000005'),
(6,'Software Engineering Final Exam','2026-06-15 09:00:00',120,FALSE,'uploads/exams/placeholder.enc','l0000001-0000-0000-0000-000000000006'),
(7,'Artificial Intelligence Final Exam','2026-06-16 09:00:00',120,FALSE,'uploads/exams/placeholder.enc','l0000001-0000-0000-0000-000000000007'),
(8,'Data Structures Final Exam','2026-06-17 09:00:00',120,FALSE,'uploads/exams/placeholder.enc','l0000001-0000-0000-0000-000000000008'),
(9,'Cloud Computing Final Exam','2026-06-18 09:00:00',120,FALSE,'uploads/exams/placeholder.enc','l0000001-0000-0000-0000-000000000009'),
(10,'Mobile Development Final Exam','2026-06-19 09:00:00',120,FALSE,'uploads/exams/placeholder.enc','l0000001-0000-0000-0000-000000000010'),
(11,'Digital Forensics Final Exam','2026-06-20 09:00:00',120,FALSE,'uploads/exams/placeholder.enc','l0000001-0000-0000-0000-000000000011'),
(12,'Cryptography Final Exam','2026-06-21 09:00:00',120,FALSE,'uploads/exams/placeholder.enc','l0000001-0000-0000-0000-000000000012'),
(13,'HCI Final Exam','2026-06-22 09:00:00',120,FALSE,'uploads/exams/placeholder.enc','l0000001-0000-0000-0000-000000000013'),
(14,'Ethical Hacking Final Exam','2026-06-23 09:00:00',120,FALSE,'uploads/exams/placeholder.enc','l0000001-0000-0000-0000-000000000014'),
(15,'Research Methods Final Exam','2026-06-24 09:00:00',120,FALSE,'uploads/exams/placeholder.enc','l0000001-0000-0000-0000-000000000015');

-- ─── ROOMS (1 active per course) ─────────────────────────────────────────────
INSERT INTO rooms (course_id, title, room_token, created_by, is_active) VALUES
(1,'Cybersecurity Live Session','room-token-cs-001','l0000001-0000-0000-0000-000000000001',TRUE),
(2,'Web Dev Live Session','room-token-wd-002','l0000001-0000-0000-0000-000000000002',TRUE),
(3,'Database Live Session','room-token-db-003','l0000001-0000-0000-0000-000000000003',TRUE),
(4,'OS Live Session','room-token-os-004','l0000001-0000-0000-0000-000000000004',TRUE),
(5,'Networks Live Session','room-token-net-005','l0000001-0000-0000-0000-000000000005',TRUE),
(6,'Software Eng Live Session','room-token-se-006','l0000001-0000-0000-0000-000000000006',TRUE),
(7,'AI Live Session','room-token-ai-007','l0000001-0000-0000-0000-000000000007',TRUE),
(8,'Algorithms Live Session','room-token-alg-008','l0000001-0000-0000-0000-000000000008',TRUE),
(9,'Cloud Live Session','room-token-cloud-009','l0000001-0000-0000-0000-000000000009',TRUE),
(10,'Mobile Dev Live Session','room-token-mob-010','l0000001-0000-0000-0000-000000000010',TRUE),
(11,'Forensics Live Session','room-token-for-011','l0000001-0000-0000-0000-000000000011',TRUE),
(12,'Cryptography Live Session','room-token-cry-012','l0000001-0000-0000-0000-000000000012',TRUE),
(13,'HCI Live Session','room-token-hci-013','l0000001-0000-0000-0000-000000000013',TRUE),
(14,'Ethical Hacking Live Session','room-token-eth-014','l0000001-0000-0000-0000-000000000014',TRUE),
(15,'Research Methods Live Session','room-token-res-015','l0000001-0000-0000-0000-000000000015',TRUE);

-- ─── AUDIT LOG (sample entries) ──────────────────────────────────────────────
INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address) VALUES
('l0000001-0000-0000-0000-000000000001','UPLOAD_EXAM','exam','1','127.0.0.1'),
('l0000001-0000-0000-0000-000000000002','UPLOAD_EXAM','exam','2','127.0.0.1'),
('s0000001-0000-0000-0000-000000000001','SUBMIT_ASSIGNMENT','submission','1','127.0.0.1'),
('s0000001-0000-0000-0000-000000000002','SUBMIT_ASSIGNMENT','submission','2','127.0.0.1'),
('l0000001-0000-0000-0000-000000000001','CREATE_COURSE','course','1','127.0.0.1');

SELECT setval(pg_get_serial_sequence('courses', 'id'), COALESCE((SELECT MAX(id) FROM courses), 1), true);
SELECT setval(pg_get_serial_sequence('quizzes', 'id'), COALESCE((SELECT MAX(id) FROM quizzes), 1), true);

COMMIT;

# Design and Development of a Secure Blended Learning Environment (SBLE)

**A Thesis Submitted in Partial Fulfilment of the Requirements for the Award of a Degree in Computer Science / Information Technology**

---

**Author:** [Student Name]
**Supervisor:** [Supervisor Name]
**Institution:** [University / College Name]
**Department:** [Department Name]
**Date:** March 2026

---

## Declaration

I hereby declare that this thesis is my own original work and has not been submitted for any other degree or examination at any other institution. All sources consulted have been duly acknowledged.

**Signature:** ___________________________
**Date:** ___________________________

---

## Abstract

The proliferation of digital learning platforms has transformed modern education, yet many existing systems fail to adequately address the intersection of pedagogical flexibility and cybersecurity. This thesis presents the design and development of a Secure Blended Learning Environment (SBLE) — a full-stack web application that integrates course management, encrypted content delivery, handwritten assignment submission, in-house real-time voice and video collaboration, and secure examination management into a single, self-hosted platform.

The system is built on a React frontend, a Node.js/Express backend, a MySQL relational database, and a Keycloak identity provider for OAuth2/OIDC-based authentication and role-based access control. All learning materials, assignments, and examination papers are encrypted at rest using AES-256-CBC. Real-time collaboration is achieved through an in-house WebRTC signaling server, eliminating dependency on third-party conferencing tools. The platform is containerised using Docker and served through an Nginx reverse proxy with TLS enforcement.

Evaluation demonstrates that the SBLE meets its three primary objectives: enhanced and secure learning delivery, independent real-time collaboration, and encrypted content lifecycle management. The system provides a viable, privacy-preserving alternative to commercial learning management systems for academic institutions.

**Keywords:** Blended Learning, Cybersecurity, AES-256 Encryption, WebRTC, Keycloak, RBAC, LMS, Docker, Node.js, React

---

## Acknowledgements

The author wishes to thank [Supervisor Name] for guidance and support throughout this project, the faculty of [Department Name] for providing the academic foundation for this work, and [any other acknowledgements].

---

## Table of Contents

1. Introduction
2. Literature Review
3. System Requirements and Analysis
4. System Design and Architecture
5. Implementation
6. Security Analysis
7. Testing and Evaluation
8. Discussion
9. Conclusion and Future Work
10. References
11. Appendices

---

## Chapter 1: Introduction

### 1.1 Background

The global shift toward blended and online learning, accelerated by the COVID-19 pandemic, has exposed significant gaps in the security posture of widely adopted Learning Management Systems (LMS). Platforms such as Moodle, Canvas, and Blackboard, while feature-rich, often rely on third-party integrations for video conferencing (e.g., Zoom, BigBlueButton), store content without end-to-end encryption, and offer limited control over data residency — a critical concern for institutions operating under data protection regulations such as GDPR, FERPA, or national equivalents.

Furthermore, the continued prevalence of handwritten assessments in many academic disciplines — particularly in mathematics, engineering, and the arts — is poorly supported by most digital platforms, which are optimised for typed submissions. This creates a disconnect between digital delivery and traditional assessment practices.

### 1.2 Problem Statement

Existing blended learning platforms present three core deficiencies relevant to this work:

1. **Security and privacy gaps**: Learning materials, examination papers, and student submissions are frequently stored in plaintext or with inadequate encryption, exposing sensitive academic content to unauthorised access.

2. **Third-party conferencing dependency**: Institutions relying on Zoom or BigBlueButton for live sessions surrender control over session data, recording storage, and user privacy to external vendors.

3. **Inadequate support for handwritten work**: Despite the continued use of handwritten assessments, most LMS platforms lack native, secure mechanisms for submitting and managing scanned or photographed handwritten work.

### 1.3 Objectives

This project addresses the above deficiencies through three primary objectives:

**Objective 1:** To design and develop a Secure Blended Learning Environment (SBLE) that enhances learning delivery while ensuring strong cybersecurity, data protection, and user privacy for students and academic staff, including support for handwritten assignment submission.

**Objective 2:** To develop an integrated, in-house voice and collaboration module that eliminates dependency on third-party conferencing tools such as Zoom and BigBlueButton.

**Objective 3:** To implement a mechanism for secure upload, storage, encryption, and distribution of learning materials, assignments, quizzes, and examination content.

### 1.4 Scope

The SBLE is scoped as a web-based platform targeting higher education institutions. It covers:
- User authentication and role-based access (student, lecturer, admin)
- Course and enrollment management
- Encrypted upload and download of learning materials
- Assignment creation and submission (typed, scanned, handwritten)
- Quiz creation with auto-grading
- Encrypted examination paper management with controlled release
- In-house WebRTC-based video/audio collaboration rooms with text chat
- Audit logging for security accountability

Out of scope: mobile native applications, plagiarism detection, and learning analytics dashboards (identified as future work).

### 1.5 Significance of the Study

This work contributes a practical, open-source reference architecture for secure blended learning that institutions can self-host, retaining full data sovereignty. It demonstrates that strong security controls — encryption at rest, OIDC authentication, RBAC, TLS enforcement — can be integrated into a modern LMS without sacrificing usability or feature completeness.

### 1.6 Thesis Structure

Chapter 2 reviews related literature. Chapter 3 defines system requirements. Chapter 4 presents the system architecture and design. Chapter 5 details the implementation. Chapter 6 analyses the security model. Chapter 7 covers testing and evaluation. Chapter 8 discusses findings. Chapter 9 concludes with future directions.

---

## Chapter 2: Literature Review

### 2.1 Blended Learning: Definition and Evolution

Blended learning combines face-to-face instruction with online digital delivery, allowing learners to control the pace, place, and path of their learning (Horn & Staker, 2015). The model has evolved from simple content repositories to interactive platforms supporting synchronous and asynchronous communication, formative assessment, and collaborative learning.

Graham (2006) defines blended learning as the combination of instruction from two historically separate models — traditional face-to-face and distributed online learning — noting that the blend can occur at the activity, course, programme, or institutional level. The COVID-19 pandemic forced a rapid, unplanned transition to fully online delivery, revealing both the potential and the limitations of existing platforms (Hodges et al., 2020).

### 2.2 Security Challenges in E-Learning Platforms

Al-Fuqaha et al. (2015) identify data confidentiality, integrity, and availability as the three pillars of e-learning security. Common vulnerabilities in LMS platforms include:

- **Insecure direct object references**: Allowing students to access materials or submissions belonging to other users by manipulating URL parameters.
- **Insufficient access control**: Inadequate role separation between students, instructors, and administrators.
- **Plaintext data storage**: Sensitive content stored without encryption, vulnerable to database breaches.
- **Session hijacking**: Weak session management enabling token theft.

Alqahtani and Alsubait (2020) conducted a security audit of Moodle deployments and found that over 60% of surveyed institutions had not applied critical security patches, and fewer than 30% encrypted stored files. This underscores the gap between security best practices and real-world deployments.

### 2.3 Encryption in Educational Systems

The Advanced Encryption Standard (AES), standardised by NIST in 2001, remains the gold standard for symmetric encryption. AES-256 in CBC (Cipher Block Chaining) mode provides strong confidentiality for stored data. Stallings (2017) notes that AES-256 offers a security margin sufficient to resist brute-force attacks for the foreseeable future, making it appropriate for protecting examination papers and student submissions.

Key management is identified as the primary challenge in file encryption systems. In the SBLE, the encryption key is stored as an environment variable, injected at runtime via Docker secrets — a pragmatic approach for institutional deployments that balances security with operational simplicity.

### 2.4 Identity Management and Access Control

OAuth 2.0 and OpenID Connect (OIDC) have become the de facto standards for federated identity management in web applications (Hardt, 2012; Sakimura et al., 2014). Keycloak, an open-source identity and access management solution maintained by Red Hat, implements these standards and provides additional features including multi-factor authentication, fine-grained RBAC, and session management.

Ferraiolo et al. (2001) established the formal model for Role-Based Access Control (RBAC), demonstrating that role assignment reduces the complexity of access policy management in multi-user systems. In educational contexts, RBAC maps naturally to the distinct roles of student, lecturer, and administrator, each with different permissions over courses, content, and assessments.

### 2.5 Real-Time Communication: WebRTC

WebRTC (Web Real-Time Communication) is a W3C and IETF standard enabling peer-to-peer audio, video, and data communication directly in web browsers without plugins (Jennings et al., 2013). The protocol stack includes:

- **ICE (Interactive Connectivity Establishment)**: Negotiates the optimal network path between peers.
- **DTLS (Datagram Transport Layer Security)**: Encrypts media streams in transit.
- **SRTP (Secure Real-time Transport Protocol)**: Provides confidentiality and integrity for audio/video.

Compared to server-mediated solutions like Zoom or BigBlueButton, a self-hosted WebRTC implementation eliminates vendor lock-in and ensures that session data does not leave the institution's infrastructure. The signaling layer — responsible for exchanging session descriptions and ICE candidates — is implemented in the SBLE using WebSockets, a lightweight and widely supported protocol.

### 2.6 Existing LMS Platforms: A Comparative Analysis

| Feature | Moodle | Canvas | Blackboard | SBLE |
|---|---|---|---|---|
| Open source | Yes | No | No | Yes |
| Self-hosted | Yes | Limited | Limited | Yes |
| File encryption at rest | No (plugin) | No | No | Yes (AES-256) |
| In-house video conferencing | No | No | No | Yes (WebRTC) |
| Handwritten submission | Limited | Limited | Limited | Yes (secure upload) |
| OIDC/OAuth2 auth | Plugin | Yes | Yes | Yes (Keycloak) |
| RBAC | Yes | Yes | Yes | Yes |
| Audit logging | Limited | Limited | Yes | Yes |

This comparison highlights that no existing open-source LMS natively combines all four features — encryption at rest, in-house conferencing, handwritten submission support, and self-hosted OIDC — that the SBLE delivers.

### 2.7 Summary

The literature establishes a clear need for a security-first LMS that integrates encryption, federated identity, real-time collaboration, and flexible assessment submission into a cohesive, self-hosted platform. The SBLE addresses this gap by applying established security standards (AES-256, OAuth2/OIDC, TLS 1.3, RBAC) within a modern full-stack architecture.

---

## Chapter 3: System Requirements and Analysis

### 3.1 Requirements Elicitation

Requirements were gathered through analysis of the three project objectives, review of existing LMS security literature, and consideration of typical academic workflows. Requirements are classified as functional (FR) and non-functional (NFR).

### 3.2 Functional Requirements

**Authentication and User Management**

- FR1.1: The system shall authenticate users via Keycloak using OAuth2/OIDC.
- FR1.2: The system shall support three roles: student, lecturer, and admin.
- FR1.3: The system shall synchronise authenticated user profiles into the local database on first login.
- FR1.4: Role-based access control shall restrict API endpoints based on the authenticated user's role.

**Course Management**

- FR2.1: Lecturers shall be able to create, update, and deactivate courses.
- FR2.2: Students shall be able to enrol in available courses.
- FR2.3: The system shall display only courses relevant to the authenticated user.

**Learning Materials**

- FR3.1: Lecturers shall be able to upload learning materials (PDF, DOCX, images).
- FR3.2: All uploaded materials shall be encrypted at rest using AES-256-CBC before storage.
- FR3.3: Enrolled students shall be able to download and view decrypted materials.
- FR3.4: File type and size (max 50MB) shall be validated on upload.

**Assignments**

- FR4.1: Lecturers shall be able to create assignments with title, description, and due date.
- FR4.2: Students shall be able to submit assignments as typed text, scanned documents, or handwritten image uploads.
- FR4.3: Submitted files shall be encrypted at rest.
- FR4.4: Lecturers shall be able to grade submissions and provide written feedback.

**Quizzes**

- FR5.1: Lecturers shall be able to create quizzes with MCQ, true/false, and short-answer questions.
- FR5.2: Lecturers shall be able to publish quizzes to make them visible to students.
- FR5.3: The system shall auto-grade MCQ and true/false questions upon submission.
- FR5.4: Correct answers shall not be exposed to students during or after attempts.

**Examinations**

- FR6.1: Lecturers shall be able to upload encrypted examination papers.
- FR6.2: Examination papers shall remain inaccessible to students until explicitly released by the lecturer.
- FR6.3: Released examination papers shall be decrypted and streamed to authorised students on demand.
- FR6.4: All exam access events shall be recorded in the audit log.

**Real-Time Collaboration**

- FR7.1: Lecturers shall be able to create collaboration rooms linked to a course.
- FR7.2: The system shall support peer-to-peer video and audio communication via WebRTC.
- FR7.3: Participants shall be able to mute/unmute audio and enable/disable video.
- FR7.4: The room shall include a real-time text chat panel.
- FR7.5: The collaboration module shall not depend on any third-party conferencing service.

**Audit and Logging**

- FR8.1: The system shall log all sensitive actions (uploads, downloads, exam access, submissions) with user ID, action type, resource, and IP address.

### 3.3 Non-Functional Requirements

- NFR1 (Security): All data in transit shall be protected by TLS 1.2 or higher. All stored files shall be encrypted with AES-256.
- NFR2 (Authentication): Session tokens shall be short-lived JWTs issued by Keycloak, refreshed automatically.
- NFR3 (Performance): API responses for non-file endpoints shall complete within 500ms under normal load.
- NFR4 (Scalability): The system shall be containerised to allow horizontal scaling of the backend service.
- NFR5 (Availability): The system shall be deployable with Docker Compose for single-node institutional deployments.
- NFR6 (Usability): The frontend shall be responsive and navigable without specialist training.
- NFR7 (Maintainability): Code shall follow modular MVC patterns with clear separation of concerns.
- NFR8 (Data Privacy): No student data shall be transmitted to third-party services.

### 3.4 Use Case Summary

| Actor | Use Case |
|---|---|
| Student | Login, enrol in course, view materials, submit assignment, attempt quiz, join collaboration room |
| Lecturer | Login, create course, upload materials, create assignment, grade submission, create/publish quiz, upload/release exam, create room |
| Admin | Manage users, view audit logs, manage all courses |

---

# SBLE — IEEE References

**Project:** Secure Blended Learning Environment (SBLE)
**Citation Style:** IEEE (Institute of Electrical and Electronics Engineers)

Each reference is mapped to the system component or design decision it supports.

---

## Authentication & Identity Management

[1] D. Hardt, "The OAuth 2.0 Authorization Framework," IETF RFC 6749, Oct. 2012.
[Online]. Available: https://www.rfc-editor.org/rfc/rfc6749
*Supports: Keycloak OAuth2 integration, token-based API authentication.*

[2] N. Sakimura, J. Bradley, M. Jones, B. de Medeiros, and C. Mortimore,
"OpenID Connect Core 1.0," OpenID Foundation, Nov. 2014.
[Online]. Available: https://openid.net/specs/openid-connect-core-1_0.html
*Supports: Keycloak OIDC login flow, JWT token structure.*

[3] M. Jones, J. Bradley, and N. Sakimura, "JSON Web Token (JWT),"
IETF RFC 7519, May 2015. [Online]. Available: https://www.rfc-editor.org/rfc/rfc7519
*Supports: JWT access tokens, token validation in keycloak-connect middleware.*

[4] E. Rescorla, "The Transport Layer Security (TLS) Protocol Version 1.3,"
IETF RFC 8446, Aug. 2018. [Online]. Available: https://www.rfc-editor.org/rfc/rfc8446
*Supports: Nginx TLS 1.2/1.3 configuration, HTTPS enforcement.*

[5] R. Fielding and J. Reschke, "Hypertext Transfer Protocol (HTTP/1.1):
Authentication," IETF RFC 7235, Jun. 2014.
[Online]. Available: https://www.rfc-editor.org/rfc/rfc7235
*Supports: Bearer token authentication scheme on all API routes.*

---

## Cryptography & File Security

[6] M. Dworkin, "Recommendation for Block Cipher Modes of Operation:
Methods and Techniques," NIST Special Publication 800-38A, Dec. 2001.
[Online]. Available: https://csrc.nist.gov/publications/detail/sp/800-38a/final
*Supports: AES-256-CBC file encryption implementation in fileEncryption.js.*

[7] National Institute of Standards and Technology, "Advanced Encryption Standard (AES),"
FIPS Publication 197, Nov. 2001.
[Online]. Available: https://csrc.nist.gov/publications/detail/fips/197/final
*Supports: AES-256 key selection and block cipher design.*

[8] M. Bellare and C. Namprempre, "Authenticated Encryption: Relations among
Notions and Analysis of the Generic Composition Paradigm,"
Journal of Cryptology, vol. 21, no. 4, pp. 469–491, Oct. 2008.
*Supports: Rationale for using IV prepending in AES-CBC encrypted files.*

[9] T. Ylonen and C. Lonvick, "The Secure Shell (SSH) Transport Layer Protocol,"
IETF RFC 4253, Jan. 2006. [Online]. Available: https://www.rfc-editor.org/rfc/rfc4253
*Supports: Secure transport design principles applied to file transfer.*

---

## Web Application Security

[10] OWASP Foundation, "OWASP Top Ten 2021," Open Web Application Security Project, 2021.
[Online]. Available: https://owasp.org/www-project-top-ten/
*Supports: Helmet security headers, rate limiting, input validation, RBAC design.*

[11] E. Rescorla, "HTTP Over TLS," IETF RFC 2818, May 2000.
[Online]. Available: https://www.rfc-editor.org/rfc/rfc2818
*Supports: HTTPS enforcement via Nginx, HSTS header configuration.*

[12] A. Barth, "HTTP State Management Mechanism," IETF RFC 6265, Apr. 2011.
[Online]. Available: https://www.rfc-editor.org/rfc/rfc6265
*Supports: httpOnly and Secure cookie flags on Express sessions.*

[13] T. Berners-Lee, R. Fielding, and L. Masinter, "Uniform Resource Identifier (URI):
Generic Syntax," IETF RFC 3986, Jan. 2005.
[Online]. Available: https://www.rfc-editor.org/rfc/rfc3986
*Supports: REST API URL design and routing conventions.*

[14] R. Fielding, "Architectural Styles and the Design of Network-based Software
Architectures," Ph.D. dissertation, Univ. of California, Irvine, 2000.
[Online]. Available: https://www.ics.uci.edu/~fielding/pubs/dissertation/top.htm
*Supports: RESTful API design principles throughout the Express backend.*

---

## Real-Time Communication & WebRTC

[15] C. Jennings, H. Boström, and J.-I. Bruaroey, "WebRTC 1.0: Real-Time
Communication Between Browsers," W3C Recommendation, Jan. 2021.
[Online]. Available: https://www.w3.org/TR/webrtc/
*Supports: RTCPeerConnection, offer/answer model, ICE candidate exchange in Room.js.*

[16] J. Rosenberg et al., "Interactive Connectivity Establishment (ICE):
A Protocol for Network Address Translator (NAT) Traversal,"
IETF RFC 8445, Jul. 2018. [Online]. Available: https://www.rfc-editor.org/rfc/rfc8445
*Supports: ICE candidate handling in WebRTC signaling server.*

[17] I. Fette and A. Melnikov, "The WebSocket Protocol,"
IETF RFC 6455, Dec. 2011. [Online]. Available: https://www.rfc-editor.org/rfc/rfc6455
*Supports: WebSocket signaling server (ws npm package), WebSocket upgrade in Nginx.*

[18] J. Rosenberg, R. Mahy, P. Matthews, and D. Wing,
"Session Traversal Utilities for NAT (STUN),"
IETF RFC 5389, Oct. 2008. [Online]. Available: https://www.rfc-editor.org/rfc/rfc5389
*Supports: STUN server configuration in Room.js ICE_SERVERS.*

[19] R. Mahy, P. Matthews, and J. Rosenberg,
"Traversal Using Relays around NAT (TURN): Relay Extensions to STUN,"
IETF RFC 5766, Apr. 2010. [Online]. Available: https://www.rfc-editor.org/rfc/rfc5766
*Supports: Coturn TURN server integration for cross-network WebRTC.*

---

## Database & Data Management

[20] E. F. Codd, "A Relational Model of Data for Large Shared Data Banks,"
Communications of the ACM, vol. 13, no. 6, pp. 377–387, Jun. 1970.
*Supports: Relational database schema design in MySQL (users, courses, enrollments, etc.).*

[21] R. Elmasri and S. B. Navathe, Fundamentals of Database Systems, 7th ed.
Hoboken, NJ: Pearson, 2016.
*Supports: Entity-relationship design, foreign key constraints, normalization in init.sql.*

[22] M. Fowler, Patterns of Enterprise Application Architecture.
Boston, MA: Addison-Wesley, 2002.
*Supports: Sequelize ORM usage, Active Record pattern, repository abstraction.*

---

## Server-Sent Events & Notifications

[23] I. Hickson, "Server-Sent Events," W3C Recommendation, Feb. 2015.
[Online]. Available: https://www.w3.org/TR/eventsource/
*Supports: SSE implementation in sseService.js and useNotifications.js hook.*

[24] R. Fielding et al., "Hypertext Transfer Protocol (HTTP/1.1): Semantics and Content,"
IETF RFC 7231, Jun. 2014. [Online]. Available: https://www.rfc-editor.org/rfc/rfc7231
*Supports: HTTP response streaming, Content-Type: text/event-stream.*

---

## E-Learning & Blended Learning

[25] C. R. Graham, "Blended Learning Systems: Definition, Current Trends, and Future
Directions," in Handbook of Blended Learning: Global Perspectives, Local Designs,
C. J. Bonk and C. R. Graham, Eds. San Francisco, CA: Pfeiffer, 2006, pp. 3–21.
*Supports: Blended learning design rationale — combining online materials, quizzes, and live rooms.*

[26] D. R. Garrison and H. Kanuka, "Blended Learning: Uncovering Its Transformative
Potential in Higher Education," The Internet and Higher Education,
vol. 7, no. 2, pp. 95–105, 2004.
*Supports: Pedagogical justification for combining asynchronous (materials, assignments)
and synchronous (WebRTC rooms) learning modalities.*

[27] S. B. Shum and R. Ferguson, "Social Learning Analytics,"
Educational Technology & Society, vol. 15, no. 3, pp. 3–26, 2012.
*Supports: Audit logging design — tracking student engagement and activity.*

---

## Software Architecture & Node.js

[28] M. Fowler, "Microservices," martinfowler.com, Mar. 2014.
[Online]. Available: https://martinfowler.com/articles/microservices.html
*Supports: Service-oriented decomposition — email, encryption, storage, scheduler as
independent services under server/src/services/.*

[29] T. Preston-Werner, "Semantic Versioning 2.0.0," semver.org, 2013.
[Online]. Available: https://semver.org/
*Supports: npm dependency versioning strategy in package.json files.*

[30] N. Nurseitov, M. Paulson, R. Reynolds, and C. Izurieta,
"Comparison of JSON and XML Data Interchange Formats: A Case Study,"
in Proc. CAINE 2009, pp. 157–162, 2009.
*Supports: JSON as the data interchange format for all REST API responses
and quiz question options storage (JSON column in MySQL).*

---

## Reference Count: 30

| Category | References |
|---|---|
| Authentication & Identity | [1] [2] [3] [4] [5] |
| Cryptography & File Security | [6] [7] [8] [9] |
| Web Application Security | [10] [11] [12] [13] [14] |
| Real-Time Communication & WebRTC | [15] [16] [17] [18] [19] |
| Database & Data Management | [20] [21] [22] |
| Server-Sent Events & Notifications | [23] [24] |
| E-Learning & Blended Learning | [25] [26] [27] |
| Software Architecture | [28] [29] [30] |

# ANNUAL SOFTWARE MAINTENANCE, SUPPORT & SERVICE LEVEL AGREEMENT (AMC)

**CONTRACT REFERENCE ID:** `FF-AMC-2026-001`  
**CONTRACT DURATION:** Exactly Twelve (12) Calendar Months (1 Year)  
**EFFECTIVE COMMENCEMENT DATE:** `[START DATE, e.g., November 1, 2026]`  
**EXPIRATION DATE:** `[END DATE, e.g., October 31, 2027]`  

---

### BETWEEN:

**1. THE SOFTWARE PROVIDER / DEVELOPER:**  
**[SOFTWARE VENDOR / DEVELOPER NAME / ENTITY]**, having its principal place of business at `[DEVELOPER ADDRESS]`, represented by its Authorized Signatory `[NAME & DESIGNATION]` (hereinafter referred to as the **"Provider"** or **"Developer"**, which expression shall unless repugnant to the context include its successors, affiliates, and permitted assigns);

### AND:

**2. THE CLIENT / BUSINESS OPERATOR:**  
**CLEAN CLEAR DRY CLEANING** (Operating unit under FreshFold System), having its principal retail location at **Shop 12, Ground Floor, Galleria Market**, registered under GSTIN **07AAAAA0000A1Z5**, contact phone: **+91 70057 28774**, represented by its Authorized Signatory `[OWNER / DIRECTOR NAME]` (hereinafter referred to as the **"Client"** or **"Store Operator"**, which expression shall unless repugnant to the context include its legal representatives, successors, and permitted assigns).

*(Provider and Client are individually referred to as a "Party" and collectively as the "Parties".)*

---

## RECITALS

**WHEREAS:**
1. Provider has designed, engineered, and deployed the proprietary web-based point-of-sale and laundry operations management platform known as **FreshFold Laundry POS** ("Software System"), comprising a React/Vite progressive counter application, Cloudflare Workers serverless backend API, Neon Serverless PostgreSQL database layer, digital receipt dispatcher, and associated subsystems.
2. Client operates a commercial dry cleaning and laundry service business under the brand **"Clean Clear Dry Cleaning"** and utilizes the Software System for mission-critical operations, including customer relationship management, piece-rate and weight-based order processing, package balance wallets, thermal receipt printing, and WhatsApp bill dispatch.
3. Client desires to engage Provider, and Provider agrees to provide ongoing software support, application maintenance, cloud infrastructure monitoring, bug rectification, data protection, and incremental feature updates for a fixed term of **one (1) year**, subject to the terms and service levels detailed herein.

**NOW, THEREFORE, IT IS MUTUALLY AGREED BY AND BETWEEN THE PARTIES AS FOLLOWS:**

---

## 1. DEFINITIONS AND INTERPRETATIONS

- **"Agreement"** means this Annual Software Maintenance, Support & Service Level Agreement, including all Schedules, Annexures, and approved Amendments hereto.
- **"Software System"** means the FreshFold Laundry POS application code base, including:
  - React/Vite single-page counter interface;
  - Cloudflare Workers API routes (`/api/*`);
  - Neon PostgreSQL relational database schemas, migrations, and queries;
  - Client-side persistence engine and offline fallback (`localStorage`);
  - Thermal receipt rendering engine (58mm/80mm format), PDF bill generator, WhatsApp digital invoice dispatch service, and item tagging system.
- **"Normal Working Hours"** means Monday to Saturday, 09:00 AM to 08:00 PM IST, excluding national public holidays.
- **"Downtime"** means any unplanned period during which the Client’s staff cannot create orders, retrieve customer balances, or process intake at the POS terminal due to an error in the Software System or cloud infrastructure within Provider’s direct administrative scope.
- **"Scheduled Maintenance"** means planned system upgrades, database optimization, or security patches performed outside core store operating hours (10:00 PM to 07:00 AM IST) with at least 24 hours advance notification to Client.

---

## 2. DURATION AND TERM

2.1. This Agreement shall take effect on the **Effective Commencement Date** and shall remain in full force and binding effect for a period of **exactly one (1) year (12 calendar months)**, terminating automatically on the Expiration Date unless renewed or extended in writing by mutual consent.  
2.2. **Renewal Review**: At least thirty (30) calendar days prior to the expiration date, both Parties shall meet to conduct an annual performance review. Subject to mutual agreement on commercial rates, this Agreement may be renewed for successive one-year terms upon execution of a written renewal annexure.

---

## 3. SCOPE OF SERVICES

Provider shall render the following engineering, maintenance, and support services throughout the 1-year contract term:

### 3.1. Infrastructure & Cloud Operations
- Continuous monitoring and maintenance of the **Cloudflare Workers** edge runtime environment and static asset distribution.
- Administration and health monitoring of the **Neon Serverless PostgreSQL** database, connection poolers, and SSL connectivity.
- Secret management and environment variable synchronization across production (`DATABASE_URL`, worker authentication tokens).
- Uptime monitoring to ensure target service availability of **99.9%** (excluding approved scheduled maintenance).

### 3.2. Bug Rectification & Patch Management
- Proactive identification and rapid correction of coding defects, edge case calculation errors in garment/weight pricing, discount calculation errors, and database transaction deadlocks.
- Application of security patches and npm dependency vulnerability updates across frontend and worker packages.
- Maintenance of local storage fallback mechanisms ensuring store counter continuity during intermittent internet interruptions.

### 3.3. Module Maintenance
- **POS Register & Cart Engine**: Integrity of piece-count pricing, weight-rate billing, and express delivery surcharges (standard 0%, express 25%, same-day 50%).
- **Package Wallet Engine**: Correct debiting of package advance balances upon intake, package renewal tracking, and validation rules.
- **Bill Dispatch & Printing**: Compatibility updates for thermal receipt printers (ESC/POS 58mm/80mm), PDF invoice generators, and WhatsApp link generation protocols.
- **Authentication & Role Security**: Maintenance of admin authentication gates, cashier PIN restrictions, and credential management.

### 3.4. Continuous Feature Iteration Allowance
- Provider includes up to **fifteen (15) engineering hours per quarter** (totaling sixty (60) hours across the 1-year term) for minor UX improvements, custom report exports, print styling adjustments, and promotional banner configurations (such as seasonal pamphlets and discount tier setups) at no additional consulting charge.

---

## 4. SERVICE LEVEL AGREEMENT (SLA) & RESPONSE TIERS

Support incidents reported by Client via authorized channels (WhatsApp Emergency Line, Support Email, or Portal) shall be classified according to the severity matrix below:

| Severity Level | Definition / Impact | Initial Response Time | Target Resolution Time | Availability Window |
| :--- | :--- | :--- | :--- | :--- |
| **Severity 1 (Critical Outage)** | Complete POS stoppage; cash register unable to process orders; database unreachable with no fallback; billing halted across counter. | **Within 60 Minutes** | **Within 4 Hours** | 24 Hours / 7 Days a week |
| **Severity 2 (Major Defect)** | Core feature degraded (e.g., WhatsApp bill link dispatch failing, wallet auto-deduction error), but counter staff can still record orders manually. | **Within 2 Hours** | **Within 12 Hours** | 09:00 AM – 09:00 PM IST |
| **Severity 3 (Moderate Defect)** | Non-blocking defect; thermal print alignment defect; incorrect report filtering; cosmetic styling glitch. | **Within 6 Hours** | **Within 48 Hours** | Normal Working Hours |
| **Severity 4 (Change Request)** | Request for new feature, price list alteration, or aesthetic pamphlet layout update. | **Within 24 Hours** | Scheduled in next sprint release | Normal Working Hours |

---

## 5. DATA PROTECTION, BACKUPS & DISASTER RECOVERY

5.1. **Automated Daily Backups**: Provider shall ensure automated daily logical snapshots of the Neon PostgreSQL database are executed and retained for a rolling window of thirty (30) days.  
5.2. **Disaster Recovery (RTO / RPO)**:
- **Recovery Point Objective (RPO)**: Not more than twelve (12) hours of transactional data in the event of catastrophic primary cloud failure.
- **Recovery Time Objective (RTO)**: Full restoration of the production database and edge worker routing within four (4) hours of declared cloud disaster.
5.3. **Data Ownership**: All customer records, order histories, transactions, phone numbers, and billing data are the exclusive intellectual and business property of the Client. Provider shall not monetize, disclose, transfer, or parse Client data for any external purpose.
5.4. **End-of-Term Data Handover**: Upon completion or termination of this Agreement, Provider shall provide a comprehensive SQL dump (`schema.sql` + full data records in `.sql` and `.json` format) to Client within five (5) business days.

---

## 6. FINANCIAL TERMS, FEES & PAYMENT SCHEDULE

6.1. **Annual Maintenance Fee**: The agreed annual fee for the 1-Year Maintenance & SLA contract is **₹ [ANNUAL AMOUNT, e.g., 72,000 / $1,200]** plus applicable GST (18%).  
6.2. **Payment Schedule**: The annual fee shall be payable by Client to Provider according to the chosen billing option:
- **Option A (Quarterly in Advance)**: Four (4) equal installments of **₹ [AMOUNT / 4] + GST**, payable within seven (7) days of invoice at the beginning of each calendar quarter.
- **Option B (Annual Lump Sum)**: Single upfront payment of **₹ [DISCOUNTED AMOUNT] + GST** upon signing of this Agreement (eligible for a 10% prompt payment discount).
6.3. **Cloud Infrastructure Cost Allocation**:
- Standard Cloudflare Workers free/basic plan and Neon Postgres serverless baseline compute up to agreed database tier limits are included in the maintenance fee.
- If store scale exceeds standard usage tiers (e.g., exceeding 50,000 monthly orders or database storage exceeding 10 GB), external hosting charges levied directly by Cloudflare / Neon / Twilio WhatsApp API shall be billed directly to Client at actuals with prior written approval.
6.4. **Late Payment**: Invoices overdue beyond fifteen (15) calendar days from due date shall attract simple interest at the rate of 1.5% per month until settled.

---

## 7. CLIENT OBLIGATIONS & HARDWARE PREREQUISITES

Client shall be responsible for:
1. Providing stable internet connectivity at the store counter (Shop 12, Galleria Market).
2. Supplying and maintaining POS desktop/tablet hardware, ESC/POS compatible thermal receipt printers, barcode/QR scanners, and electronic scales.
3. Ensuring cashier staff safeguard administrative passwords and individual staff PINs (`1234`, `0000`, `2222`).
4. Timely notification to Provider of any unexpected errors or operational anomalies.

---

## 8. INTELLECTUAL PROPERTY RIGHTS

8.1. **Provider IP**: The underlying source code framework, libraries, and proprietary algorithms of the FreshFold Laundry POS engine remain the intellectual property of Provider.  
8.2. **Client License**: Provider grants Client a perpetual, non-exclusive, non-transferable, royalty-free license to use, operate, and execute the Software System for the operations of Clean Clear Dry Cleaning across all designated store counters.  
8.3. **Custom Assets**: All store logos, branding assets, custom pamphlets, customer lists, and store price configurations belong solely to Client.

---

## 9. CONFIDENTIALITY & NON-DISCLOSURE

Each Party agrees to hold in strict confidence all proprietary technical, financial, and operational information disclosed by the other Party during the term of this Agreement. This confidentiality obligation shall survive the expiration or termination of this Agreement for a period of two (2) years.

---

## 10. TERMINATION & EXIT MANAGEMENT

10.1. **Termination for Convenience**: Either Party may terminate this Agreement by giving sixty (60) calendar days prior written notice to the other Party. In the event of early termination for convenience by Client, fees paid for the ongoing quarter are non-refundable.  
10.2. **Termination for Cause**: Either Party may terminate this Agreement immediately upon written notice if:
- The other Party commits a material breach of this Agreement and fails to cure such breach within fifteen (15) calendar days of receiving written notice;
- Either Party becomes insolvent, enters liquidation, or ceases commercial operations.  
10.3. **Post-Termination Transition Support**: Upon termination, Provider shall assist Client in migrating DNS records, transferring Cloudflare/Neon administrative credentials, and executing complete data export to ensure uninterrupted store operations.

---

## 11. GOVERNING LAW & DISPUTE RESOLUTION

11.1. This Agreement shall be governed by, construed, and enforced in accordance with the laws of India.  
11.2. Any dispute, controversy, or claim arising out of or relating to this contract shall first be resolved through good-faith amicable negotiation between authorized representatives.  
11.3. If unresolved within thirty (30) days, the dispute shall be referred to arbitration in accordance with the Arbitration and Conciliation Act, 1996. The seat and venue of arbitration shall be `[CITY, e.g., New Delhi / Bangalore / Imphal]`, and proceedings shall be conducted in English. The courts of that jurisdiction shall have exclusive jurisdiction.

---

## SCHEDULE A: TECHNICAL SPECIFICATIONS & COVERED CODEBASE

The scope of this 1-Year Agreement covers the following codebase components repository-wide:

1. **Frontend Architecture**:
   - `src/App.jsx`, `src/main.jsx`, `src/styles.css`
   - Customer Modal (`src/components/CustomerModal.jsx`)
   - POS Counter Register (`src/components/PosRegister.jsx`)
   - Order Detail & Tagging (`src/components/OrderDetailModal.jsx`, `src/components/ItemTagModal.jsx`)
   - Package Sales & Wallet Management (`src/components/PackageSaleModal.jsx`, `src/components/PackageManageModal.jsx`)
   - Thermal Receipt & PDF Generators (`src/components/ThermalReceiptModal.jsx`, `src/lib/pdfGenerator.js`)
   - Store Settings & Pamphlet Showcase (`src/components/SettingsModal.jsx`, `src/components/PamphletModal.jsx`)
   - Public Web Bill & WhatsApp Sharing (`src/components/PublicBillView.jsx`, `src/components/CrystalClearBill.jsx`)
2. **Serverless Backend & Database**:
   - Cloudflare Worker (`src/worker.js`, `wrangler.jsonc`)
   - Neon PostgreSQL Schema & Scripts (`schema.sql`, `scripts/setup-db.mjs`)
   - Client persistence and sync layer (`src/lib/persistence.js`)
3. **Automated Testing Suite**:
   - Customer package linkage tests (`test/customerPackageLinkage.test.js`)
   - Digital bill sharing tests (`test/digitalBillSharing.test.js`)
   - Order history and export tests (`test/orderHistoryExportAndFilter.test.js`)
   - Production authentication guard tests (`test/productionAuthGuard.test.js`)

---

## SCHEDULE B: COMMERCIAL PAYMENT SCHEDULE (1-YEAR BREAKDOWN)

*(All figures in INR, exclusive of 18% GST)*

| Milestone / Quarter | Service Period | Billing Due Date | Amount (INR) |
| :--- | :--- | :--- | :--- |
| **Q1 (Kickoff & Setup)** | Month 1 to Month 3 | Within 7 days of Start Date | ₹ 18,000 + GST |
| **Q2 (Mid-Year Review)** | Month 4 to Month 6 | 1st day of Month 4 | ₹ 18,000 + GST |
| **Q3 (Operational Peak)** | Month 7 to Month 9 | 1st day of Month 7 | ₹ 18,000 + GST |
| **Q4 & Annual Audit** | Month 10 to Month 12 | 1st day of Month 10 | ₹ 18,000 + GST |
| **TOTAL (12 MONTHS)** | Full Year Cycle | — | **₹ 72,000 + 18% GST** |

---

## EXECUTION & SIGNATURES

**IN WITNESS WHEREOF, the Parties hereto have executed this Annual Software Maintenance, Support & Service Level Agreement by their duly authorized representatives on the date first written above.**

| For & on behalf of Provider: | For & on behalf of Client: |
| :--- | :--- |
| **[SOFTWARE PROVIDER NAME / COMPANY]** | **CLEAN CLEAR DRY CLEANING** |
| | *(FreshFold Operations Unit)* |
| Signature: _______________________________ | Signature: _______________________________ |
| Name: `[PROVIDER SIGNATORY NAME]` | Name: `[CLIENT SIGNATORY NAME]` |
| Designation: `[e.g., Lead Architect / Director]` | Designation: `[e.g., Proprietor / Managing Director]` |
| Date: `____ / ____ / 2026` | Date: `____ / ____ / 2026` |
| Seal / Stamp: | Seal / Stamp: |
| Witness 1: _______________________________ | Witness 2: _______________________________ |
| Name: `[WITNESS 1 NAME]` | Name: `[WITNESS 2 NAME]` |

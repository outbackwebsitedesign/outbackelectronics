// Built-in policy text. Ships in code (unlike policies.db, which is gitignored
// and starts empty on every fresh deploy) and is used as a fallback whenever no
// staff override exists in policies.db for a given audience+slug, see
// getEffectivePolicies() in server.js. Editing and publishing a policy through
// the admin UI writes an override row to policies.db; it does not touch this file.
//
// Body text uses {{email}}, {{phone}}, {{phoneHref}}, {{address}}, {{abn}}
// placeholders, which the public site interpolates client-side from shop
// settings before rendering as markdown (see PoliciesPage in pages-info.jsx).
// {{phoneHref}} is the phone number with whitespace stripped, for tel: links.

const BODY_SELLER_TERMS = `_SELLER AGREEMENT · OHD001_

## Terms and Conditions for Sellers

This Agreement is between Outback Electronics ('OE', 'we', 'us', or 'our'), located at {{address}}, ABN {{abn}}, and the individual or entity approved to list products on the Platform ('Seller', 'you', or 'your').

This Agreement incorporates the following documents by reference, together forming the entire seller agreement:

- **OHD001** - Terms and Conditions for Sellers (this document)
- **OHD002** - Design Quality Standards
- **OHD003** - Fees Schedule
- **OHD004** - Listing Requirements

By submitting an application to list on the Platform, by listing a product, or by continuing to use the Platform after receiving notice of updated terms, you agree to be bound by this Agreement. We recommend that all prospective Sellers obtain independent legal advice before entering into this Agreement.

### 1. Definitions

- **"Agreement"** means OHD001–OHD004 collectively.
- **"ACL"** means the Australian Consumer Law (Schedule 2 of the _Competition and Consumer Act 2010_ (Cth)).
- **"Commission"** means the percentage fee applied by OE to the Seller's listed price, per OHD003.
- **"ELV"** means Extra Low Voltage, circuits or systems operating at or below 50 V AC or 120 V DC.
- **"Listing Fee"** means the monthly subscription fee charged per OHD003.
- **"Platform"** means the Outback Electronics website at [outbackelectronics.com.au](https://outbackelectronics.com.au) and any related services.
- **"Products"** means items listed by the Seller on the Platform.
- **"Sale Proceeds"** means the price paid by a customer for a Product, inclusive of Commission.
- **"Seller Content"** means all images, descriptions, schematics, branding, videos, and other materials submitted by the Seller for listing purposes.

### 2. Nature of the Relationship

OE operates the Platform as a marketplace. The Seller is an independent business; nothing in this Agreement creates a partnership, joint venture, franchise, employment, or general agency relationship, except as expressly stated below.

OE acts as a **disclosed payment collection agent** for the Seller. When a customer purchases a Product, OE collects the Sale Proceeds on the Seller's behalf and remits the net amount (after Commission, Listing Fees, and any other deductions) to the Seller per Section 9.

**ACL Supplier Status.** The Seller acknowledges that under the ACL, OE may be treated as a 'supplier' of Products in respect of customers and therefore shares in the consumer guarantee obligations attaching to Products sold through the Platform. The Seller's obligation to indemnify OE under Section 12 reflects that any ACL liability OE incurs in respect of a Seller's Product originates with that Seller's product or conduct, not OE's own default.

### 3. ELV/LV Platform Scope

The Platform accepts **only Extra Low Voltage (ELV, ≤50 V AC / ≤120 V DC) and Low Voltage (LV) products.** Mains-voltage (240 V AC) products, components, or designs are strictly prohibited - there are no exceptions. This includes any product that connects directly to a mains supply, any mains-rated power supply unit, or any circuit designed to operate at mains voltages even if it includes a step-down stage.

Acceptable categories include: Arduino, Raspberry Pi, and custom microcontroller boards and shields; embedded systems and ELV sensor/control modules; 12 V / 24 V / 48 V automotive, caravan, marine, and off-grid electronics; battery management systems; DC-DC converters; and other circuits operating entirely within ELV limits. Software, firmware, and digital products related to the above hardware are also accepted.

By listing a Product, the Seller warrants the Product operates exclusively within ELV/LV limits. If OE identifies or receives a credible complaint that a listed Product operates at mains voltage, OE may immediately remove the listing without notice and may terminate this Agreement under Section 14.

### 4. Product Quality and Safety

All Products must comply with the Design Quality Standards in OHD002. The Seller is solely responsible for ensuring Products are safe, comply with all applicable Australian Standards (including _AS/NZS 3820_ and any other relevant standard for the product category), and are fit for the purpose represented in the listing.

The Seller must not list Products containing counterfeit, substandard, or materially misrepresented components. Specifications, capabilities, limitations, and intended use must be accurately represented.

**Pre-Listing Samples.** OE may request a sample of any Product before or after listing. Samples must be provided within 14 days of request at the Seller's cost. If a sample fails OE's quality assessment, the listing is suspended until the Seller demonstrates compliance.

**Ongoing Compliance.** If a design or component changes materially after initial listing, the Seller must notify OE and provide updated documentation and, if requested, a new sample.

### 5. Fulfillment Model

**OE operates as a pure digital marketplace and does not hold, handle, warehouse, or fulfill any seller inventory.** All Products are dispatched directly by the Seller to the customer from the Seller's own location. The sender name and address on a parcel will be the Seller's, not Outback Electronics'.

The Seller bears sole responsibility for all shipping, packaging, logistics, and delivery of Products to customers. The Seller bears all risk of loss or damage in transit from dispatch until the Product is delivered. OE retains all shipping and handling fees collected from customers per OHD003; these cover platform costs and do not represent any logistics service provided by OE.

OE accepts no liability for delayed, damaged, or lost shipments arising from the Seller's fulfillment process. The Seller must have adequate processes in place to track orders, respond to delivery inquiries, and resolve delivery failures promptly.

### 6. Intellectual Property Licence

By submitting Seller Content to OE, the Seller grants OE a **non-exclusive, royalty-free, worldwide, sub-licensable licence** to use, reproduce, adapt, display, publish, and distribute Seller Content for the purpose of operating and promoting the Platform and the Seller's listings.

This licence continues for 90 days after termination to allow OE to complete outstanding orders and wind down listings in an orderly manner. After 90 days, OE will remove Seller Content from active listings. OE may retain archival copies for legal, audit, and dispute-resolution purposes.

The Seller warrants that: (a) it owns or holds a sufficient licence over all Seller Content; (b) OE's authorised use of Seller Content will not infringe any third party's intellectual property rights; and (c) no Seller Content is defamatory, obscene, misleading, or unlawful.

OE retains all intellectual property rights in the Platform, its design, branding, and infrastructure. Nothing in this Agreement transfers any OE IP to the Seller.

### 7. Listing Fees and Commission

Fees and commission rates are set out in the Fees Schedule (OHD003).

**Commission Mechanics.** OE adds the applicable Commission percentage to the Seller's nominated price to determine the customer price. Example at 20%: Seller nominates $50 → customer price is $60 → OE remits $50 to the Seller and retains $10 as Commission. The customer is aware they are purchasing from a third-party seller on the Outback Electronics platform.

**Listing Fee.** Monthly Listing Fees are charged per OHD003 regardless of whether any Products are sold. Failure to pay within 14 days of the invoice date results in suspension of all listings; reinstatement occurs within 2 business days of full payment.

**Listing Fees are non-refundable.** Commission is refunded to the Seller if the corresponding sale is subsequently refunded to the customer. **OE retains all shipping and handling fees** collected from customers.

### 8. GST

Unless otherwise stated, all fees and Commission amounts are exclusive of GST. OE is not currently registered for GST, so no GST is added to fees or Commission and OE's invoices are not tax invoices. If OE becomes GST-registered, GST will be added to fees and Commission from that date and OE will issue valid tax invoices accordingly.

The Seller warrants that it holds a valid ABN and complies with all GST obligations under the _A New Tax System (Goods and Services Tax) Act 1999_ (Cth). The Seller must provide its ABN to OE before listing. OE may withhold tax from payments under the ATO's no-ABN withholding rules if the Seller fails to provide a valid ABN.

Where OE collects payment from customers as a disclosed agent, the Seller is the entity making the taxable supply for GST purposes. The Seller is responsible for accounting for GST on its supplies.

### 9. Payment Terms

OE will remit Sale Proceeds to the Seller within **14 days of customer payment clearing** to OE's payment processor, by electronic funds transfer to the Seller's nominated Australian bank account.

Each remittance will be accompanied by a payment statement itemising sales, Commission deducted, Listing Fees deducted, refunds processed, and the net amount paid.

OE may withhold or set off against any remittance: outstanding Listing Fees, refunds issued to customers, amounts owed under any indemnity in this Agreement, or any other amount the Seller owes OE.

If a customer initiates a chargeback, OE will notify the Seller promptly. The Seller must provide reasonable assistance to contest chargebacks it believes are unwarranted. If a chargeback is upheld, the corresponding amount will be debited against the next remittance.

### 10. Customer Support and Complaint Response

The Seller is primarily responsible for customer support in relation to its Products. The Seller must:

- Respond to all customer inquiries within **5 business days**;
- Process ACL-compliant refunds, replacements, or repairs within **10 business days** of a valid customer request;
- Notify OE of any product safety issue, recall, or regulatory investigation within **2 business days** of becoming aware of it.

If the Seller fails to meet these timeframes, OE may at its discretion: (a) issue a refund to the customer and debit the amount from the next Seller remittance; (b) remove or suspend the affected listing; or (c) refer the matter to the ACCC, Consumer Affairs, or another relevant authority. Repeated or serious failures are grounds for immediate termination under Section 14.

### 11. Australian Consumer Law Compliance

**Nothing in this Agreement overrides, excludes, or limits any right a consumer has under the ACL,** including consumer guarantee rights under Part 3-2, Division 1 (acceptable quality, fitness for purpose, match description, and other guarantees).

The Seller must not represent to customers that ACL guarantees are excluded or that the Seller's return policy is more restrictive than ACL minimum entitlements. Phrases such as 'no refunds' or 'all sales final' must not appear in Seller communications or listings.

**Unfair Contract Terms.** The Seller acknowledges the operation of the unfair contract terms provisions of the ACL (ss.23–28, as extended to small business contracts from November 2023). Any term of this Agreement found to be an unfair contract term is void to the extent of the unfairness; the remainder of the Agreement continues in force.

### 12. Product Liability Indemnity

The Seller indemnifies OE and its officers, employees, agents, and contractors against all claims, losses, damages, liabilities, penalties, costs (including reasonable legal costs), and expenses arising from or in connection with:

- Any personal injury, death, or property damage (including fire, explosion, or electrical damage) caused or allegedly caused by a Product listed or sold by the Seller;
- Any breach by the Seller of this Agreement, including OHD002 and OHD004;
- Any ACL consumer guarantee liability that OE incurs as a result of a defect, misdescription, or non-compliance in a Seller's Product;
- Any infringement by the Seller of a third party's intellectual property rights;
- Any misleading or deceptive conduct by the Seller in connection with its Products or listings;
- Any claim by a regulatory body (including the ACCC, Consumer Affairs, or an electrical safety regulator) arising from a Seller's Product.

**Insurance.** The Seller must maintain, at its own expense, adequate public liability and product liability insurance with a minimum cover of **$5,000,000 per occurrence** from a reputable insurer. The Seller must provide OE with a certificate of currency on request and within 7 days of any renewal.

### 13. Copyright and IP Compliance

The Seller must hold all necessary rights to list, sell, and grant OE a licence over all Products and Seller Content. The Seller must not list: counterfeit, replica, or unauthorised goods; products that infringe any patent, registered design, trade mark, or copyright; or products that incorporate third-party open-source hardware or software in violation of the applicable licence terms.

If OE receives a credible intellectual property complaint from a rights-holder, OE may immediately remove the listing and suspend the Seller's account pending investigation. If the complaint is upheld, OE may terminate this Agreement under Section 14 without liability to the Seller.

### 14. Termination

**Termination by Notice.** Either party may terminate this Agreement by providing **30 days' written notice** by email.

**Immediate Termination by OE.** OE may terminate immediately by written notice if the Seller: lists or sells a mains-voltage product; causes or is subject to a confirmed product safety incident (fire, personal injury, or serious property damage); commits an ACL offence or faces regulatory enforcement action; infringes third-party intellectual property rights; fails to pay fees within 30 days of the due date; becomes insolvent, enters administration, receivership, or liquidation; or engages in misleading, deceptive, or fraudulent conduct.

**Effect of Termination.** On termination: listings are removed within 7 days (immediately for termination for cause); outstanding customer orders placed before termination are completed or refunded; Consigned Stock is returned at the Seller's cost within 30 days; final payment is made within 30 days after all outstanding customer transactions are resolved and all amounts owed to OE are deducted.

Sections 6 (IP Licence - 90-day tail), 11 (ACL), 12 (Indemnity), 13 (IP Compliance), 17 (Governing Law), and any accrued payment obligations survive termination.

### 15. Dispute Resolution

If a dispute arises in connection with this Agreement, the parties agree to the following process before commencing litigation (except for urgent interlocutory relief):

1. **Internal Resolution:** The aggrieved party sends a written notice of dispute. The other party must respond within 15 business days; both parties attempt good-faith resolution.
2. **Mediation:** If unresolved within 30 days of the notice, either party may refer the dispute to mediation through a mediator agreed by both parties or appointed by a recognised mediation provider. Mediation costs are shared equally.
3. **Litigation:** If mediation is unsuccessful, either party may commence proceedings in the courts of Queensland.

### 16. Variation

OE may vary this Agreement by providing **30 days' written notice** by email. The Seller may terminate within the notice period if it does not accept the changes. Continued use of the Platform after the notice period constitutes acceptance of the updated terms.

OE may vary this Agreement with immediate effect where variation is required to comply with applicable law, with written notice given as soon as reasonably practicable.

### 17. General

**Governing Law.** This Agreement is governed by the laws of Queensland, Australia. Each party submits to the non-exclusive jurisdiction of the courts of Queensland and, where applicable, the Federal Court of Australia.

**Entire Agreement.** This Agreement (OHD001–OHD004) constitutes the entire agreement between the parties and supersedes all prior representations, negotiations, and understandings.

**Severability.** If any provision is found to be void, unlawful, or unenforceable, that provision is severed and the remaining provisions continue in full force.

**Notices.** Notices under this Agreement must be given by email. Notices to OE must be sent to [{{email}}](mailto:{{email}}). Notices to the Seller will be sent to the email address on the Seller's account.

**Waiver.** Failure to enforce any provision is not a waiver of the right to enforce it in future.`;

const BODY_SELLER_QUALITY = `_SELLER AGREEMENT · OHD002_

## Design Quality Standards

This document sets out the minimum quality, safety, and presentation standards that all products listed on the Outback Electronics Platform must meet. It forms part of the Seller Agreement (OHD001–OHD004). Sellers are responsible for ongoing compliance, not only at initial listing.

If you have questions about whether your product meets these standards, contact us before listing: [{{email}}](mailto:{{email}}).

### 1. Professional Construction

Products must exhibit a professional standard of construction. The following will not be accepted: permanent breadboard or veroboard assemblies (these are prototyping mediums, not finished products); exposed, uninsulated wiring presenting a contact or short-circuit risk; loose components not secured within an enclosure or on a PCB; and hand-written or missing labelling on boards and enclosures.

Acceptable construction includes: custom PCBs (through-hole or SMD), commercially manufactured enclosures, and 3D-printed enclosures of appropriate rigidity and thermal resistance for the application.

### 2. ELV/LV Compliance (Mandatory)

All products must operate exclusively at Extra Low Voltage (ELV: ≤50 V AC / ≤120 V DC) or within Low Voltage (LV) limits. No mains-voltage (240 V AC) products or components are accepted. This requirement is absolute.

**Applicable standards** (as relevant to the product category):

- _AS/NZS 3820_ - Essential requirements for electrical equipment;
- _AS/NZS 62368-1_ - Audio/video, IT, and communications technology equipment;
- _AS/NZS 4268_ - Radio communications equipment;
- Relevant IEC standards for the specific product type.

Sellers do not need formal certification for all products, but designs must be assessed against the relevant standard and documentation must demonstrate how the design meets its requirements.

### 3. Functionality and Performance

Products must perform all functions and meet all specifications as advertised. Known limitations must be clearly disclosed in the listing, non-disclosure constitutes a misdescription under the ACL. Sellers must test products thoroughly before listing. OE may request evidence of testing at any time.

### 4. Documentation Requirements

For each listed product, the Seller must provide OE with (or make available to customers as applicable):

- **Schematic diagram**, clearly annotated with component values and part numbers;
- **Assembly or connection instructions**, step-by-step with clear diagrams;
- **Usage and safety guidelines**, operating voltage/current ranges, maximum ratings, and specific precautions;
- **Specification sheet**, key electrical parameters, dimensions, and environmental ratings;
- **Bill of Materials (BOM)**, key components and sources for quality audit purposes.

Documentation must be accurate, current, and written in clear English. Outdated or inaccurate documentation is a listing breach.

### 5. Component Quality

All components must be genuine, specification-grade parts from reputable manufacturers or authorised distributors. The use of counterfeit, salvaged, out-of-specification, or remarked components is prohibited and constitutes a serious breach of the Seller Agreement. Sellers should be able to provide sourcing information for key components on request, particularly safety-critical parts such as MOSFETs, gate drivers, voltage regulators, and battery protection ICs.

### 6. Lithium Battery Products

Products incorporating lithium cells or designed for use with lithium-based batteries are subject to additional requirements:

- Battery protection circuits (overcharge, over-discharge, overcurrent, short circuit) must be present and correctly rated;
- Cell specifications (chemistry, capacity, maximum charge/discharge current, operating temperature range) must be disclosed;
- Charging parameters must be clearly documented and must not exceed cell manufacturer's specifications;
- Enclosures must provide adequate thermal ventilation;
- Shipping must comply with IATA Dangerous Goods Regulations (DGR) and CASA requirements for lithium battery transport.

Products failing lithium battery safety requirements pose a risk of fire, explosion, and toxic gas release. Such products will not be accepted and any listed product found to be non-compliant will be immediately removed.

### 7. Reliability and Durability

Products should be designed for a reasonable lifespan appropriate to their application and price point. Key considerations: component derating (operating below maximum rated values); thermal management (heat sinks, thermal pads, or adequate PCB copper); environmental protection (conformal coating or appropriate IP rating for outdoor or automotive applications); and mechanical robustness (secure PCB mounting and strain relief on wiring harnesses).

### 8. Packaging

Products must be packaged to withstand postal and courier shipping without damage. Packaging must include: adequate cushioning; clear external labelling including product name, Seller's name or brand, and required safety warnings; required dangerous goods labelling for lithium batteries or other regulated substances; and instructions inside the package.

### 9. Compatibility Claims

Any compatibility claim (e.g., "compatible with Toyota Land Cruiser 200 Series" or "works with ESP32") must be based on actual testing, not assumptions. If compatibility has not been tested, it must not be claimed. Sellers are liable under the ACL for misdescriptions arising from untested compatibility claims.

### 10. Customer Support

Post-sale technical support is a quality obligation. Sellers must assist customers with reasonable technical questions about product integration and troubleshooting. OHD001 Section 10 sets response time requirements. A Seller that is unresponsive to legitimate customer support requests is in breach of these Quality Standards.

### 11. Incident Reporting and Continuous Improvement

Sellers should actively monitor field performance, review customer feedback, and update designs or documentation where issues are identified. If a significant quality or safety issue is identified post-listing, the Seller must notify OE within 2 business days and take appropriate remedial action (listing update, recall, or withdrawal).`;

const BODY_SELLER_FEES = `_SELLER AGREEMENT · OHD003_

## Fees Schedule

This document sets out the fees payable by Sellers for listing products on the Outback Electronics Platform. It forms part of the Seller Agreement (OHD001–OHD004). All amounts are in Australian Dollars (AUD). Unless otherwise stated, fees are **exclusive of GST** - see Section 5 for GST treatment.

For questions about fees, contact us at [{{email}}](mailto:{{email}}).

### 1. Monthly Listing Fee

A monthly listing fee applies based on the number of active product listings, counted at the beginning of each billing month.

| Number of Active Listings | Rate (per listing / month, excl. GST) |
|---|---|
| 1 – 10 | $0.75 |
| 11 – 50 | $0.50 |
| 51 – 100 | $0.30 |
| Over 100 | Contact us for a custom arrangement |

**Example:** A Seller with 15 active listings pays 15 × $0.50 = $7.50 per month (+ GST if applicable).

Listing Fees are **non-refundable** and payable regardless of whether any Products are sold during the month. If a Seller reduces their listing count mid-month, the reduced rate applies from the following month.

### 2. Commission

A commission fee applies to every product sold through the Platform. The commission is **added to the Seller's nominated price** to determine the price displayed to customers. The Seller receives their full nominated price on every completed sale.

**Current commission rate: up to 20% of the Seller's nominated price.** The actual rate applicable to each Seller will be confirmed in their onboarding agreement or account settings.

**Worked example at 20%:**

- Seller nominates a price of $50.00
- OE adds 20% → customer price displayed is $60.00
- Customer pays $60.00
- OE deducts $10.00 commission and remits $50.00 to the Seller (less any Listing Fee deductions)

**Commission on refunds:** If a sale is refunded to the customer, the Commission for that sale is also refunded to the Seller. Listing Fees are not affected by refunds.

### 3. Payment of Listing Fees

Listing Fees are invoiced at the beginning of each calendar month and are due within **14 days** of the invoice date. OE may deduct outstanding Listing Fees from the Seller's remittance before paying Sale Proceeds. If Listing Fees remain unpaid after 30 days, all Seller listings will be paused until full payment is received.

### 4. Payment of Sale Proceeds

OE remits Sale Proceeds to the Seller within **14 days** of customer payment clearing, by electronic funds transfer to the Seller's nominated Australian bank account. Each remittance is accompanied by a payment statement itemising: gross sales, Commission deducted, Listing Fees deducted, refunds processed, and the net amount paid.

**OE retains all shipping and handling fees** collected from customers. These are not remitted to Sellers.

### 5. GST Treatment

All fees in this document are exclusive of GST. OE is not currently registered for GST, so no GST is added to Listing Fees or Commission and OE's invoices are not tax invoices while this remains the case. If OE becomes GST-registered, GST will be added to fees and Commission from that date and OE will issue valid tax invoices accordingly. Sellers are responsible for their own GST obligations on their product sales, regardless of OE's registration status. Sellers must provide a valid ABN to OE; failure to do so may result in OE withholding tax from remittances under the ATO's no-ABN withholding rules.

### 6. Refunds and Chargebacks

**Customer refunds:** Where OE processes a customer refund, the corresponding Sale Proceeds are reversed in the next remittance and the Commission for that sale is also reversed. Listing Fees are not affected.

**Chargebacks:** If a customer-initiated chargeback is upheld by the payment processor, the charged-back amount is debited from the Seller's next remittance. OE will notify the Seller and provide an opportunity to contest the chargeback if the Seller believes it is unwarranted.

### 7. Optional Advertising Services

Optional advertising services (featured placements, promotional campaigns, targeted advertisements) are available for an additional fee at the Seller's sole discretion. Pricing is provided upon request and a separate written agreement is required. To enquire, contact us at [{{email}}](mailto:{{email}}).

### 8. Fee Changes

OE may change Listing Fees or the Commission rate by providing **30 days' written notice** by email. Updated rates apply to the first billing period commencing after the notice period expires. If a Seller does not accept a fee change, they may terminate the Agreement per OHD001 Section 14 within the notice period.

### 9. Pricing Integrity

Sellers must not manipulate their nominated prices to artificially distort the commission calculation. OE reserves the right to audit listed prices and, if manipulation is detected, to apply corrective measures or terminate the Agreement for cause.`;

const BODY_SELLER_LISTING = `_SELLER AGREEMENT · OHD004_

## Listing Requirements

This document sets out the requirements that all product listings on the Outback Electronics Platform must satisfy. It forms part of the Seller Agreement (OHD001–OHD004). By listing a product, the Seller warrants compliance with these requirements at the time of submission and on an ongoing basis.

Listings that do not meet these requirements may be suspended, corrected by OE, or removed. Repeated or serious non-compliance is a breach of OHD001 and may result in termination. Questions: [{{email}}](mailto:{{email}}).

### 1. Product Photographs

Photographs must: be well-lit, in focus, and accurately represent the product; include at least one shot on a plain white or neutral background; show multiple angles where features are not visible from a single perspective; be of sufficient resolution for customers to zoom in on detail (minimum 1000 × 1000 px recommended); not contain watermarks, unrelated branding, or promotional text overlays; and be of the actual product, not renders, stock images, or competitor products.

**IP in photographs:** By submitting photographs, the Seller warrants it owns the copyright or holds a licence to use them, and grants OE the licence in OHD001 Section 6 to display them in connection with the listing.

### 2. Product Title

Titles must: accurately describe the product (misleading titles breach the ACL); be concise, preferred format is [Brand / Seller Name] [Product Name] [Key Spec or Variant]; use title case only (not ALL CAPS); not contain promotional language in the title field; and not include competitor brand names for search optimisation purposes.

### 3. Product Description

**Required information:** full and accurate specifications (voltage, current, power, dimensions, weight, operating temperature, etc.); intended purpose and application; condition (new, refurbished, or open-box); known limitations or incompatibilities (non-disclosure is a misdescription under the ACL); what is included in the package; any tools, skills, or additional components required; and relevant safety warnings.

**Language:** Descriptions must be written in clear, correct English. Automated translations without human review are not acceptable.

**Price:** All prices in Australian Dollars (AUD) inclusive of GST where applicable. No foreign-currency prices may be displayed.

**Stock availability:** Listings must reflect actual available stock and must be updated promptly. Selling products that cannot be fulfilled within the stated timeframe is a breach of the ACL and this Agreement.

### 4. Keywords and Search Terms

Keywords must be genuinely relevant to the product. Prohibited: competitor brand names used as keywords; irrelevant or misleading search terms; and keyword stuffing (repeating the same word or phrase to game search rankings).

### 5. Pricing Compliance

Sellers must comply with all price representation requirements under the ACL. In particular: the customer price (Seller price + OE Commission) is the total price, no hidden extras; any "was price" or "RRP" shown must reflect a genuine prior selling price or manufacturer's RRP (false RRPs are misleading under ACL s.18 and may constitute a false representation under ACL s.29(1)(i)); and Sellers must not create artificial urgency through false countdown timers or fabricated stock level warnings.

### 6. Refund and Return Policy Disclosure

Sellers must clearly communicate their refund and return policy in the listing or seller profile. The policy must not be less generous than ACL minimum consumer guarantee entitlements. Phrases such as "no refunds" or "all sales final" that purport to exclude ACL rights must not appear in listings or Seller communications.

### 7. Contact Information

Sellers must maintain accurate, monitored contact information in their seller profile. An email address monitored within 5 business days is the minimum requirement. Failure to maintain contact information or to respond to OE or customer communications is a breach of this Agreement.

### 8. Intellectual Property and Authenticity

All listed products must be genuine and the Seller's own work, or legitimately licensed or authorised for sale. Sellers must not list: counterfeit, cloned, or unauthorised reproductions of another party's product; products that infringe a patent, registered design, trade mark, or copyright; or open-source hardware or software projects listed in violation of the applicable open-source licence terms.

The Seller grants OE the IP licence set out in OHD001 Section 6 for all content submitted with a listing, including photographs, descriptions, schematics, and videos. The Seller warrants it has the right to grant this licence.

### 9. Legal and Regulatory Compliance

Listings must comply with all applicable Australian laws and regulations, including: the Australian Consumer Law (accurate descriptions, no misleading claims); electrical safety regulations (ELV/LV products only, see OHD002 Section 2); dangerous goods regulations (correct labelling for lithium batteries and other regulated items); trade marks (no unauthorised use of third-party trade marks); and ACCC product safety standards applicable to the product category.

### 10. Videos (Optional)

Videos included in listings must: be no longer than 5 minutes; be of professional quality (stable footage, clear audio or subtitles, good lighting); include the Seller's business name or brand for attribution; relate to the product (demonstrations, assembly instructions, and feature overviews encouraged); not contain misleading claims or unsubstantiated comparative advertising; and be owned or appropriately licensed by the Seller. OE may require removal of any video that does not meet these standards or that contravenes applicable law.

### 11. Listing Accuracy and Maintenance

The Seller is responsible for keeping listings accurate and up-to-date, including: updating specifications if the product design changes materially; updating stock availability promptly; removing listings for products the Seller can no longer fulfil; and notifying OE within 2 business days if a product is subject to a recall or safety issue. OE may suspend or remove listings found to be inaccurate, out of date, or non-compliant.

### 12. Platform Policy Compliance

All listings must comply with the Seller Agreement (OHD001–OHD004) and the consumer-facing policies published on the Platform (Terms and Conditions, Return Policy, and Disclaimer). In the event of any conflict between these Listing Requirements and OHD001, OHD001 prevails.`;

const BODY_TERMS_PRIVATE = `_LEGAL · TERMS AND CONDITIONS_

## Terms and Conditions

We are Outback Electronics ('Company', 'we', 'us', or 'our'), a mobile electronics services provider registered in Australia. Our ABN is {{abn}}. Our correspondence and returns address is {{address}}, Australia. **We do not operate a public shopfront.** All in-person visits are by prior appointment only; mail-in correspondence and returns are accepted at any time without appointment.

We operate the website [outbackelectronics.com.au](https://outbackelectronics.com.au) (the 'Site'), as well as any other related products and services that refer or link to these legal terms (collectively, the 'Legal Terms').

You can contact us by phone at [{{phone}}](tel:{{phoneHref}}), by email at [{{email}}](mailto:{{email}}), or by mail to {{address}}, Australia. Please contact us before visiting in person.

**PLEASE READ THESE LEGAL TERMS CAREFULLY BEFORE USING THE SERVICES. BY ACCESSING, BROWSING, REGISTERING ON, PURCHASING FROM, SUBMITTING A FORM ON, OR OTHERWISE USING THE SERVICES IN ANY WAY, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND UNCONDITIONALLY AGREE TO BE BOUND BY ALL OF THESE LEGAL TERMS AND ALL POLICIES INCORPORATED HEREIN BY REFERENCE. IF YOU DO NOT AGREE, YOU MUST IMMEDIATELY CEASE ALL USE OF THE SERVICES. YOUR CONTINUED USE OF THE SERVICES FOLLOWING THE POSTING OF ANY UPDATED LEGAL TERMS CONSTITUTES ACCEPTANCE OF THOSE CHANGES.**

The Services are intended for users who are at least 18 years old. By using the Services you represent that you are 18 years of age or older.

### 1. Our Services

The Services are not intended for distribution in jurisdictions where such use would be contrary to law. Users accessing the Services from other locations do so on their own initiative and are solely responsible for compliance with local laws.

### 2. Intellectual Property Rights

We own or are the licensee of all intellectual property rights in our Services, including all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics (collectively, the 'Content'), as well as the trademarks, service marks, and logos (the 'Marks'). These are protected by copyright and trademark laws in Australia and around the world.

We grant you a non-exclusive, non-transferable, revocable licence to access the Services and download or print Content solely for your personal, non-commercial use. No Content or Marks may be exploited for any commercial purpose without our express prior written permission. Requests may be directed to {{email}}.

By posting Contributions, you grant us an unrestricted, irrevocable, perpetual, royalty-free worldwide licence to use, reproduce, distribute, and exploit your Contributions for any purpose. You are solely responsible for your Contributions and may not post anything illegal, harassing, defamatory, obscene, or misleading.

### 3. User Representations

By using the Services you represent that: (1) all information you submit is true, accurate, and complete; (2) you have the legal capacity to agree to these terms; (3) you are not a minor; (4) you will not use automated means to access the Services; (5) you will not use the Services for illegal or unauthorised purposes.

### 4. User Registration

You agree to keep your password confidential and are responsible for all use of your account. We may remove usernames that are inappropriate or objectionable.

### 5. Products

We endeavour to display products accurately but cannot guarantee colours, features, or specifications are error-free. All products are subject to availability. Prices are subject to change. Product descriptions are provided in good faith and do not constitute a warranty beyond what is required by the Australian Consumer Law.

**Australian Consumer Law - Consumer Guarantees:** Our goods come with guarantees that cannot be excluded under the Australian Consumer Law. You are entitled to a replacement or refund for a major failure and compensation for any other reasonably foreseeable loss or damage. You are also entitled to have goods repaired or replaced if they fail to be of acceptable quality and the failure does not amount to a major failure. Nothing in these Legal Terms excludes, restricts, or modifies any right or remedy you have under the Australian Consumer Law.

**Electrical Safety and Compliance - ELV/LV Products Only.** Outback Electronics works exclusively with Extra Low Voltage (ELV, ≤50 V AC / ≤120 V DC) and Low Voltage (LV) equipment. We do not supply, repair, or provide services for mains-connected (240 V AC) equipment, and we are not licensed to perform mains-voltage electrical work. Nothing on this Site or in our Services should be interpreted as advice, instruction, or authorisation for mains-voltage work. All mains-voltage electrical installation, repair, or modification work must only be performed by a licensed electrician under applicable state or territory electrical safety legislation (including _AS/NZS 3000_). If your project requires work on mains-voltage infrastructure, please engage a licensed electrician - we can help with the ELV/LV side only. We make no representation regarding the safety ratings, compliance certifications, or fitness for purpose of third-party products or components. You are responsible for verifying that any product is appropriate for your intended application and installation environment before purchase or use.

**Lithium Battery Safety.** Products containing lithium cells, or sold for use with lithium-based batteries, carry inherent risks including fire, explosion, and toxic gas release if the cells are punctured, overcharged, over-discharged, short-circuited, exposed to excessive heat or moisture, physically damaged, or otherwise mishandled. You must handle, charge, store, transport, and dispose of lithium batteries strictly in accordance with manufacturer specifications and all applicable dangerous-goods regulations. We are not liable for any property damage (including fire damage or total property loss), personal injury, or death arising from improper handling, storage, charging, modification, or disposal of lithium batteries, to the fullest extent permitted by applicable law. Nothing in this clause limits your rights under the Australian Consumer Law where a product sold by us is defective.

**Third-Party Products and Marketplace Sellers.** Products listed and sold by third-party sellers on our marketplace are the sole responsibility of those sellers. Outback Electronics makes **no representation, warranty, or guarantee of any kind** regarding the quality, safety, fitness for purpose, compliance, accuracy of description, or any other characteristic of third-party products. We do not independently test, inspect, or certify third-party products before or after listing. Your purchase contract for a third-party product is with the seller, not with Outback Electronics. Your rights under the Australian Consumer Law in relation to third-party products run primarily against that seller as the vendor and supplier. If you have a complaint, warranty claim, or dispute regarding a third-party product, you must direct that claim to the seller. Outback Electronics will not be liable for any loss, damage, personal injury, property damage, or adverse outcome arising from a third-party product, to the fullest extent permitted by applicable law. Outback Electronics' role is limited to operating the marketplace platform.

### 6. Purchases and Payment

We accept payment by credit or debit card and any other payment method made available through our checkout at the time of your order. All payments are in Australian Dollars. OE is not currently registered for GST, so no GST is currently added to prices; this will be updated if OE's GST registration status changes. Payment is processed securely via Stripe. By completing a purchase, you agree to Stripe's terms of service and privacy policy.

We reserve the right to refuse any order, correct pricing errors, or cancel orders placed by dealers or resellers. If we cancel an order for which payment has been received, we will issue a full refund via your original payment method.

### 7. Subscriptions

**Billing and Renewal:** Subscriptions auto-renew monthly unless cancelled.

**Free Trial:** New users receive a 14-day free trial; your chosen subscription is charged at the end of the trial. The free trial is available **once per person**, regardless of how many accounts, email addresses, or payment methods you use. We may decline to extend a further free trial to anyone we reasonably believe has already received one, including where this is identified retrospectively, and may convert a duplicate trial to a paid subscription or cancel it.

**Cancellation:** Cancel anytime via your account; takes effect at end of the current paid period. You retain access to member-only content, tutorials, and groups gated by your tier until the end of the period you have already paid for, even if you cancel before that date. Questions? Email {{email}}.

**Fee Changes:** We will communicate price changes in accordance with applicable law.

**Discontinued Tiers.** If we discontinue a membership tier or its associated benefits, we will give you reasonable notice and either migrate you to a comparable tier or refund the unused, already-paid portion of your current billing period on a pro-rata basis. We are not liable for any other loss arising from a tier being discontinued.

### 8. Return / Refunds Policy

Please review our Return Policy posted on the Services prior to making any purchases.

### 9. Software

Any software provided is offered 'AS IS' without warranty of any kind. If a EULA accompanies the software, those terms govern and take precedence over this section. You may not reproduce or redistribute software except as permitted by the applicable EULA or these Legal Terms.

**Firmware and Updates.** We may release firmware or software updates for our products from time to time. While we endeavour to test updates thoroughly, we make no representation that any update will be compatible with your specific hardware configuration or third-party components. Applying firmware or software updates is done at your own risk. We are not liable for any damage, data loss, device malfunction, or loss of functionality arising from the application of a firmware or software update, except to the extent required by the Australian Consumer Law. You should back up your device settings and data before applying any update.

**Security, Penetration-Testing, and Similar Dual-Use Tools.** Some software we provide is designed for security research, penetration testing, network diagnostics, or other purposes that could be misused to gain unauthorised access to systems or data ('Security Tools'). Security Tools are supplied **strictly for use on systems and networks you own, or for which you hold the explicit, documented authorisation of the owner** (for example, a signed penetration-testing engagement letter or scope agreement). You must comply with the _Criminal Code Act 1995_ (Cth), the _Cybercrime Act 2001_ (Cth), and all other applicable Commonwealth, state, and territory laws governing computer access, and the equivalent laws of any other jurisdiction in which you use the Security Tool.

You warrant that you will not use any Security Tool to access, damage, intercept, or interfere with any system, network, account, or data without proper authorisation, or for any other unlawful, unethical, or fraudulent purpose. Using a Security Tool against a system without authorisation is a criminal offence in Australia and most other jurisdictions, and we treat it as a serious breach of these Legal Terms.

**Reporting and Disclosure.** If we reasonably suspect that a Security Tool we have supplied is being, or has been, used for an unauthorised, unlawful, or malicious purpose, we reserve the right to report the matter - including disclosing your personal information, purchase records, and any other relevant details - to law enforcement, a relevant regulator, or an affected third party, without further notice to you. This is in addition to, and does not limit, any other rights we have under our Privacy Policy or applicable law to disclose information where required or permitted.

**No Liability for Misuse.** To the fullest extent permitted by law, we are not liable for any loss, damage, claim, fine, penalty, or legal liability arising from your use, or any other person's use, of a Security Tool for any illegal, unethical, or immoral purpose, or otherwise outside the scope of your documented authorisation. You indemnify us against any claim, loss, or liability arising from such use. Nothing in this clause excludes any consumer guarantee that cannot lawfully be excluded under the Australian Consumer Law.

### 9A. AI Assistant

Where we provide an AI-powered chat or assistant feature ('AI Assistant'), your messages and related data may be transmitted to and processed by a third-party AI service provider in order to generate a response. Do not submit sensitive personal information, payment card details, or confidential information to the AI Assistant.

**No Professional Advice; Accuracy Not Guaranteed.** Responses from the AI Assistant are generated automatically and may be inaccurate, incomplete, outdated, or entirely fabricated. They do not constitute professional, technical, electrical, legal, or safety advice, and must not be relied upon as a substitute for advice from a qualified professional, particularly for anything involving mains-voltage electricity, lithium battery handling, or safety-critical applications. You are solely responsible for independently verifying any information provided by the AI Assistant before acting on it.

**Acceptable Use.** You must not use the AI Assistant to generate, request, or attempt to extract content that is illegal, that facilitates unauthorised access to computer systems, that infringes a third party's intellectual property, or that otherwise breaches our Acceptable Use Policy. We may log, monitor, and review AI Assistant interactions to enforce this Policy and may suspend your access to the AI Assistant for breach, without notice.

**No Liability.** To the fullest extent permitted by law, we are not liable for any loss or damage arising from your reliance on AI Assistant output, including inaccurate information, code, or technical guidance. Nothing in this clause excludes any consumer guarantee that cannot lawfully be excluded under the Australian Consumer Law.

### 10. Repair and Technical Services

**Scope - ELV/LV Equipment Only.** Our Repair Services are limited to Extra Low Voltage (ELV, ≤50 V AC / ≤120 V DC) and Low Voltage (LV) equipment. We do not perform repairs on mains-connected (240 V AC) devices and we are not licensed to do so. Any device submitted for repair that is found to contain mains-voltage components beyond our scope will not be worked on; we will advise you and return the device. Where we provide repair, diagnostic, or technical services within our scope ('Repair Services'), the following additional terms apply alongside your rights under the Australian Consumer Law. By submitting a device for Repair Services, you agree to these terms.

**How to Submit a Device.** We operate as a mobile service, we do not have a public shopfront. Devices may be submitted in one of three ways: (a) **mail-in**, you may post your device to our returns address at any time without prior arrangement (please include your name, contact details, and a description of the fault); (b) **on-site service**, we can attend your location by appointment; or (c) **drop-off by appointment**, contact us first to arrange a time. Devices sent by post should be packed securely; we are not liable for damage caused by inadequate packaging in transit to us.

**Pre-Repair Quote.** We will conduct an initial assessment of your device and provide a written quote before commencing any chargeable repair. Quotes are valid for 14 days from the date of issue unless otherwise stated. We reserve the right to vary a quote if additional faults are discovered during repair that were not apparent at the time of assessment; we will notify you and obtain your approval before proceeding with any work beyond the agreed scope.

**Pre-Existing Conditions and Undisclosed Damage.** You warrant that, to the best of your knowledge, you have disclosed all known damage, faults, modifications, liquid exposure, and relevant history at the time of submission. We are not liable for any damage, deterioration, or failure caused by pre-existing conditions, undisclosed damage, prior unauthorised repairs, manufacturing defects, or latent faults that were present before submission. Where a pre-existing condition is discovered during repair, we will advise you before proceeding.

**No Liability for Consequential Failure.** Electronic devices may contain multiple faults not apparent during or immediately after repair. To the fullest extent permitted by applicable law, we are not liable for any loss, damage, fire, personal injury, or adverse outcome caused by: (a) a fault that was not the subject of the agreed repair; (b) faults that manifest after repair as a result of pre-existing conditions; or (c) the customer's subsequent use of the device inconsistently with our repair instructions or manufacturer specifications. These limitations do not limit your rights under the Australian Consumer Law in respect of our Repair Services.

**Repair Warranty.** Subject to the exclusions set out in these terms, we provide a **90-day warranty on parts and labour** for completed repair work. This warranty covers the specific fault addressed in the agreed repair and does not extend to other components, pre-existing conditions, or damage caused by subsequent misuse or further modification. The repair warranty is voided if the device is further modified, damaged, or repaired by a third party after our repair. This warranty is in addition to your rights under the Australian Consumer Law, which cannot be excluded.

**Customer Data and Software.** You are solely responsible for backing up all data, software, settings, and personal information stored on your device before submitting it for Repair Services. We take reasonable care but are not liable for any loss, alteration, or corruption of data or software that occurs in connection with Repair Services, whether arising from negligence or otherwise.

**Safety-Critical Findings.** If during the course of repair we identify a condition that, in our reasonable opinion, presents a risk of fire, electric shock, explosion, or other serious safety hazard, we reserve the right to: (a) decline to return the device to service until the safety issue is addressed; (b) require written acknowledgment of the risk before collection; or (c) advise you to have the device assessed by a licensed electrician or other qualified professional before use. We are not liable for any loss arising from our reasonable refusal to return an unsafe device to service.

**Uncollected Devices.** If you fail to collect your device or respond to our communications within 90 days of being notified that it is ready (or that repair has been declined), we reserve the right to dispose of the device responsibly. We will make at least two attempts to contact you before disposal. No compensation is payable for any device disposed of under this clause.

**Devices Beyond Economical Repair.** If the estimated cost of repair exceeds the assessed fair market value of the device, we will advise you. You may choose to proceed with repair at the quoted cost, collect the device (a diagnostic fee may apply), or authorise disposal. We are not liable for consequential loss arising from a device being assessed as beyond economical repair.

### 11. Prohibited Activities

You agree not to:

- Compile collections of our content without written permission.
- Trick, defraud, or mislead us or other users.
- Circumvent security features of the Services.
- Harm, disparage, or tarnish us or the Services.
- Harass, abuse, or harm any person using information from the Services.
- Submit false reports of abuse or misconduct.
- Use the Services in violation of any applicable law or regulation.
- Upload viruses, Trojan horses, or other disruptive material.
- Use bots, scrapers, or automated data-gathering tools.
- Impersonate another user or person.
- Interfere with or disrupt the Services or connected networks.
- Copy or adapt the Services' source code.
- Collect user email addresses for unsolicited communications.
- Use the Services for commercial competition against us.
- Sell or transfer your profile.

### 12. User Generated Contributions

You warrant that your Contributions: do not infringe third-party rights; are not false, misleading, or spam; are not obscene, violent, or harassing; do not violate any law; and do not include offensive comments about race, gender, sexual preference, or disability.

### 13. Contribution Licence

By posting Contributions you grant us an irrevocable, royalty-free, worldwide licence to use, reproduce, distribute, and exploit them for any purpose. You retain ownership of your Contributions. We may edit, re-categorise, or delete Contributions at any time without notice.

### 14. Guidelines for Reviews

Reviews must reflect firsthand experience and may not contain offensive language, discriminatory references, illegal activity, or false statements. We may remove reviews at our discretion. Reviews do not represent our views.

### 15. Third-Party Websites and Content

We are not responsible for third-party websites or content linked from or available through the Services. Inclusion of any third-party link does not imply endorsement. You hold us blameless from any harm arising from your use of third-party websites or content.

### 16. Services Management

We may monitor the Services for violations, take legal action against violators, restrict or disable Contributions, remove burdensome content, and otherwise manage the Services to protect our rights and ensure proper functioning.

### 17. Privacy Policy

We care about data privacy. Please review our Privacy Policy available on this site. By using the Services you agree to be bound by our Privacy Policy. The Services are hosted in Australia.

### 18. Term and Termination

These Legal Terms remain in effect while you use the Services. We may deny access, terminate your account, or remove your content at any time without warning. If terminated, you may not re-register under any name without our permission.

### 19. Modifications and Interruptions

We may change, modify, or remove content from the Services at any time without notice. We are not liable for any modification, suspension, or discontinuance of the Services, nor for any downtime or service interruptions.

### 20. Governing Law

These Legal Terms and any dispute or claim arising out of or in connection with them (including non-contractual disputes or claims) are governed by and construed in accordance with the laws of Queensland, Australia, without regard to conflict of law principles. To the extent court proceedings are permitted under these Legal Terms, each party irrevocably submits to the exclusive jurisdiction of the courts of Queensland, Australia.

### 21. Dispute Resolution

**Mandatory Pre-Litigation Notice.** Before commencing any legal proceedings (including arbitration) against Outback Electronics, you must provide written notice to us at [{{email}}](mailto:{{email}}) describing: (a) the nature of your claim in reasonable detail; (b) the specific relief sought; and (c) your contact details. We will have sixty (60) days from receipt of such notice to attempt to resolve the dispute informally. No proceedings may be commenced until this 60-day period has expired without resolution. This requirement is a condition precedent to any legal proceedings and, if not complied with, shall be raised as a complete defence to those proceedings.

**Binding Arbitration.** Subject to the exceptions below and to mandatory applicable law (including the Australian Consumer Law), any dispute, controversy, or claim arising out of or relating to these Legal Terms, the Services, or any breach, termination, or invalidity thereof, that is not resolved informally under the process above shall be finally settled by binding arbitration seated in Brisbane, Queensland, Australia. The arbitration shall be conducted by a single arbitrator agreed upon by the parties, or, failing agreement within 14 days, appointed by the Australian Centre for International Commercial Arbitration (ACICA). The substantive law of Queensland applies. The arbitration shall be conducted in English. The arbitral award shall be final and binding. Each party shall bear its own costs of arbitration unless the arbitrator orders otherwise. The existence and content of the arbitration shall be kept confidential except as required by law.

**Exceptions to Arbitration.** Either party may seek emergency or interim injunctive or equitable relief from a court of competent jurisdiction to prevent actual or threatened infringement, misappropriation, or violation of intellectual property rights, confidential information, or to prevent irreparable harm, without waiving the right to arbitrate the underlying dispute. Disputes that are within the jurisdiction of the Queensland Civil and Administrative Tribunal (QCAT) may be brought in that tribunal.

**Waiver of Representative and Class Proceedings.** To the maximum extent permitted by applicable law, you agree that any dispute resolution proceedings (whether in arbitration or in court, to the extent court proceedings are permitted) will be conducted only on an individual basis and not in a class, consolidated, or representative action. You waive any right to participate in any class, collective, coordinated, consolidated, or representative proceeding. Nothing in this clause limits rights you may have as a consumer under the Australian Consumer Law that cannot be waived by contract.

**Limitation of Actions.** To the maximum extent permitted by law, any claim or cause of action you may have arising out of or relating to the Services or these Legal Terms that does not arise under the Australian Consumer Law or other mandatory legislation must be commenced within one (1) year after the cause of action accrues. After that period, such claim or cause of action is permanently barred. Nothing in this clause limits time limits that cannot be contracted out of under applicable mandatory law.

### 22. Corrections

We may correct typographical errors, inaccuracies, or omissions in our content at any time without prior notice. We are not liable for any reliance placed on content that is later corrected.

### 23. Disclaimer and Assumption of Risk

**THE SERVICES ARE PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS WITHOUT ANY REPRESENTATION OR WARRANTY OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, ACCURACY, RELIABILITY, OR COMPLETENESS. WE DO NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS. YOUR USE OF THE SERVICES IS ENTIRELY AT YOUR OWN RISK.**

**Technical Information.** Any technical information, advice, guides, tutorials, or recommendations made available through the Services (including the forum, repair guides, product descriptions, and our Repair Services) are provided for general informational purposes only and do not constitute professional engineering, electrical safety, or specialist advice. Our technical content relates exclusively to ELV (Extra Low Voltage, ≤50 V AC / ≤120 V DC) and LV equipment; nothing in the Services should be read as guidance for mains-voltage (240 V AC) work. You acknowledge that electronic repairs and modifications involve inherent and serious risks including, without limitation: **electric shock capable of causing death or permanent serious injury; fire and explosion that may result in partial or complete property destruction (including damage to your home or premises); toxic gas release from damaged or mistreated battery cells; damage to connected equipment and infrastructure; personal injury; and voiding of manufacturer warranties**. You should always consult a qualified professional before undertaking any electronic repair, modification, or installation, and must engage a licensed electrician for any mains-voltage work, which is outside our scope entirely. You assume all risk associated with acting on any technical information obtained through the Services and agree that we shall not be liable for any loss, damage, personal injury, serious bodily injury, death, fire, explosion, property damage (including total loss of property), or adverse outcome resulting from reliance on such information, to the fullest extent permitted by law.

**No Reliance.** Other than as expressly set out in these Legal Terms, you should not rely on any statement made outside these Legal Terms as varying them. This clause does not exclude, and nothing in it should be read as excluding, any liability we may have for misleading or deceptive conduct under section 18 of the Australian Consumer Law, for fraudulent or negligent misrepresentation, or for any other conduct that cannot lawfully be excluded, restricted, or waived.

**Nothing in these Legal Terms excludes, restricts, or modifies any consumer guarantee, right, or remedy conferred by the Australian Consumer Law (Schedule 2 of the Competition and Consumer Act 2010 (Cth)) or any other applicable mandatory legislation that cannot lawfully be excluded.**

### 24. Limitations of Liability

**TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW: (A) IN NO EVENT WILL OUTBACK ELECTRONICS, ITS DIRECTORS, EMPLOYEES, AGENTS, CONTRACTORS, LICENSORS, OR SERVICE PROVIDERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION LOSS OF PROFITS, LOSS OF REVENUE, LOSS OF DATA, LOSS OF GOODWILL, BUSINESS INTERRUPTION, OR COST OF SUBSTITUTE SERVICES, WHETHER ARISING IN CONTRACT, TORT (INCLUDING NEGLIGENCE), STATUTE, OR OTHERWISE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES; AND (B) OUR TOTAL AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THE SERVICES OR THESE LEGAL TERMS, REGARDLESS OF THE FORM OF THE ACTION, SHALL NOT EXCEED THE GREATER OF: (I) THE TOTAL AMOUNT ACTUALLY PAID BY YOU TO US IN THE THREE (3) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM; OR (II) ONE HUNDRED AUSTRALIAN DOLLARS (AUD $100.00).**

**Exclusive Remedy.** The remedies set out in these Legal Terms are your sole and exclusive remedies in respect of any matter covered by these Legal Terms, to the maximum extent permitted by law.

**These limitations do not apply to liability arising under the Australian Consumer Law or any other applicable mandatory law where such limitation or exclusion would be unlawful.** Where our liability for failure to comply with a consumer guarantee cannot be excluded, it is limited (to the extent permitted by law) to: in the case of goods, repair, replacement, or refund of the purchase price; in the case of services, resupplying the services or paying the cost of having them resupplied.

**Product Safety and Recalls.** Nothing in these Legal Terms limits any obligation we may have under the _Competition and Consumer Act 2010_ (Cth) or applicable product safety legislation in relation to product recalls, compulsory safety standards, or bans. If we become aware that a product we have supplied may be subject to a recall or poses a safety hazard, we will take steps to notify affected customers as required by law. You can check for current product recalls at the ACCC Product Safety website: [www.productsafety.gov.au](https://www.productsafety.gov.au).

### 25. Indemnification

You agree, to the fullest extent permitted by law, to defend, indemnify, and hold harmless Outback Electronics and its officers, directors, employees, agents, contractors, licensors, suppliers, and successors from and against any and all claims, liabilities, damages, judgments, awards, losses, costs, expenses, and fees (including reasonable legal costs) arising out of or relating to: (a) your Contributions; (b) your access to or use of the Services; (c) your breach of any of these Legal Terms; (d) your violation of any applicable law or regulation; (e) your violation of any third-party right, including any intellectual property right, privacy right, or proprietary right; or (f) any claim by a third party that your Contributions caused damage to that third party. This indemnification obligation survives termination of these Legal Terms and your use of the Services.

### 26. User Data

We maintain data you transmit for managing the Services. You are solely responsible for all data you transmit. We are not liable for any loss, corruption, or unauthorised access to your data except to the extent required by the Privacy Act 1988 (Cth). You agree to maintain appropriate backups of any data important to you.

### 27. Electronic Communications

Visiting the Services, sending emails, and completing online forms constitute electronic communications. You consent to receive electronic communications and agree that all agreements, notices, disclosures, and other communications we provide electronically satisfy any legal requirement that such communications be in writing.

### 28. Force Majeure

We will not be liable or responsible for any failure or delay in the performance of our obligations under these Legal Terms to the extent that such failure or delay is caused by or results from events beyond our reasonable control, including but not limited to: acts of God; natural disasters; pandemic or epidemic; acts of government or regulatory authority; war; civil unrest; terrorist acts; strikes or industrial action; power, internet, or telecommunications outages; or failure of third-party service providers. In such circumstances, we will notify you as soon as reasonably practicable and will resume performance as soon as reasonably possible.

### 29. Miscellaneous

**Entire Agreement.** These Legal Terms, together with our Privacy Policy, Cookie Policy, Return Policy, Shipping Policy, Acceptable Use Policy, and any other policies posted on the Services, constitute the entire agreement between you and us with respect to the subject matter hereof and supersede all prior and contemporaneous agreements, representations, and understandings.

**Severability.** If any provision of these Legal Terms is held by a court or arbitrator to be invalid, illegal, or unenforceable, that provision shall be modified to the minimum extent necessary to make it enforceable, and the remainder of these Legal Terms shall continue in full force and effect.

**No Waiver.** Our failure to exercise or enforce any right or provision of these Legal Terms shall not constitute a waiver of such right or provision. Any waiver must be in writing signed by us to be effective.

**Assignment.** We may assign or transfer our rights and obligations under these Legal Terms at any time without your consent, including in connection with a merger, acquisition, or sale of assets. You may not assign your rights or obligations without our prior written consent. Any purported assignment without such consent is void.

**Relationship of the Parties.** No joint venture, partnership, employment, franchise, or agency relationship is created between you and us by these Legal Terms.

**Survival.** Provisions that by their nature should survive termination of these Legal Terms will survive, including without limitation sections relating to intellectual property, indemnification, disclaimer, limitation of liability, dispute resolution, and governing law.

### 30. Contact Us

**Outback Electronics**

- {{address}}, Australia
- Phone: [{{phone}}](tel:{{phoneHref}})
- Email: [{{email}}](mailto:{{email}})

---

**Questions?** Email [{{email}}](mailto:{{email}}), we'll get back to you as soon as we can.`;

const BODY_PRIVACY = `_LEGAL · PRIVACY POLICY_

## Privacy Policy

This Privacy Notice for Outback Electronics ('we', 'us', or 'our') describes how and why we might access, collect, store, use, and/or share ('process') your personal information when you use our services ('Services'), including when you visit [outbackelectronics.com.au](https://outbackelectronics.com.au) or engage with us in other related ways including sales, marketing, or events.

Questions or concerns? Contact us at [{{email}}](mailto:{{email}}).

### Summary of Key Points

- **What personal information do we process?** Information you provide when registering, making purchases, or contacting us.
- **Do we process sensitive personal information?** No.
- **Do we collect information from third parties?** No.
- **How do we process your information?** To provide, improve, and administer our Services, communicate with you, prevent fraud, and comply with law.
- **How do we keep your information safe?** We have appropriate organisational and technical measures in place, though no internet transmission is 100% secure.
- **What are your rights?** Depending on your location, you may have rights to access, correct, or delete your personal information.

### 1. What Information Do We Collect?

**Personal information you disclose to us.** We collect personal information that you voluntarily provide when you register, express an interest in our products or services, participate in activities, or contact us. This may include: names, phone numbers, email addresses, mailing addresses, usernames, passwords, contact preferences, and billing addresses.

**Sensitive information.** We do not process sensitive information.

**Payment data.** Payment data necessary to process purchases is handled and stored by Stripe. See Stripe's privacy notice at [stripe.com/au/privacy](https://stripe.com/au/privacy).

**Information automatically collected.** We automatically collect certain information when you visit the Services, including IP address, browser and device characteristics, operating system, language preferences, referring URLs, and usage data. We also collect information through cookies and similar technologies, including log data, device data, and approximate location data.

### 2. How Do We Process Your Information?

We process your personal information to:

- Facilitate account creation and authentication.
- Deliver services and fulfil orders.
- Respond to inquiries and offer support.
- Send administrative information and policy updates.
- Enable user-to-user communications.
- Protect individuals' vital interests and prevent harm.

### 3. What Legal Bases Do We Rely On?

**Australian residents:** Australia's _Privacy Act 1988_ (Cth) and the Australian Privacy Principles (APPs) do not prescribe 'legal bases' in the same manner as European law. Instead, they regulate the collection, use, and disclosure of personal information through the APPs. We collect personal information only where it is reasonably necessary for our functions or activities, and we handle it in accordance with the APPs. Where we rely on your consent (for example, for marketing communications), you may withdraw that consent at any time.

**EU and UK residents:** If you are located in the European Economic Area (EEA) or United Kingdom, the General Data Protection Regulation (GDPR) or UK GDPR applies to our processing of your personal information. Our legal bases for processing include: (a) performance of a contract with you; (b) our legitimate interests (e.g., fraud prevention and improving our Services) where not overridden by your interests; (c) compliance with legal obligations; and (d) your consent, where we have obtained it. You have the right to object to processing based on legitimate interests and to withdraw consent at any time without affecting the lawfulness of processing before withdrawal.

### 4. When and With Whom Do We Share Your Personal Information?

We may share your information in connection with: business transfers (e.g. merger or acquisition); use of Google Maps Platform APIs for location features; and with other users when you post public Contributions.

### 5. Do We Use Cookies and Other Tracking Technologies?

We may use cookies and similar tracking technologies (web beacons, pixels) to gather information, maintain security, save preferences, and assist with basic site functions. We also permit third parties such as Google Analytics to use tracking technologies for analytics purposes. You can opt out of Google Analytics at [tools.google.com/dlpage/gaoptout](https://tools.google.com/dlpage/gaoptout).

### 6. How Long Do We Keep Your Information?

We keep personal information only as long as necessary for the purposes outlined in this notice, or as required by applicable law, whichever is longer. Indicative retention periods are:

- **Order and transaction records:** 7 years from the date of transaction (required under Australian taxation law).
- **Customer account data:** For the duration of your account, and for up to 2 years following account closure or last activity.
- **Forum and community posts:** Until deleted by you or by us in accordance with our Acceptable Use Policy and applicable law. Deleted posts may be retained in backup systems for up to 90 days.
- **Marketing preferences and consent records:** Until you withdraw consent or unsubscribe, plus a reasonable period thereafter (generally up to 3 years) to maintain a suppression record and demonstrate compliance.
- **Repair service records:** 7 years from completion (for taxation and warranty purposes).
- **Support and complaint records:** Up to 5 years from resolution, or as required by law.

When personal information is no longer required, we delete or irreversibly de-identify it. Some information may be retained in aggregated, anonymised form for analytics or business planning purposes and is no longer treated as personal information once de-identified.

### 7. How Do We Keep Your Information Safe?

We have implemented appropriate technical and organisational security measures. However, no electronic transmission over the internet is guaranteed 100% secure. Transmission of personal information to and from our Services is at your own risk.

### 8. Do We Collect Information from Minors?

We do not knowingly collect data from or market to children under 18. If we learn such data has been collected, we will deactivate the account and delete the data. Contact us at [{{email}}](mailto:{{email}}) if you become aware of any such data.

### 9. What Are Your Privacy Rights?

Depending on your location, you may have the right to: request access to and a copy of your personal information; request rectification or erasure; restrict processing; data portability; and object to processing. You can also opt out of marketing communications at any time via the unsubscribe link in our emails or by contacting us.

To review or change your account information, log in to your customer portal account at [{{accountUrlDisplay}}]({{accountUrl}}). Questions? Email us at [{{email}}](mailto:{{email}}).

### 10. Controls for Do-Not-Track Features

We do not currently respond to DNT browser signals, as no uniform technology standard for DNT has been finalised. If a standard is adopted, we will update this notice accordingly.

### 11. Do United States Residents Have Specific Privacy Rights?

Residents of certain US states may have additional rights regarding personal information. We have not collected, sold, or shared any personal information to third parties for commercial purposes in the preceding twelve months, and we do not intend to do so. US residents may have rights including: right to know, access, correct, delete, and obtain a copy of their data; right to non-discrimination; and right to opt out of targeted advertising or profiling.

To exercise these rights, visit [{{accountUrlDisplay}}]({{accountUrl}}) or email [{{email}}](mailto:{{email}}).

### 12. Do Other Regions Have Specific Privacy Rights?

**Australia:** We collect and process your personal information in accordance with Australia's _Privacy Act 1988_ (Cth) and the Australian Privacy Principles (APPs) contained in that Act. You have the right to request access to or correction of your personal information at any time by contacting us. We will respond to access and correction requests within 30 days.

**Notifiable Data Breaches:** We are subject to the Notifiable Data Breaches (NDB) scheme under Part IIIC of the _Privacy Act 1988_. If we experience a data breach that is likely to result in serious harm to you, we will notify the Office of the Australian Information Commissioner (OAIC) and affected individuals as required by law.

If you believe we are handling your personal information in breach of the Australian Privacy Principles, you may submit a complaint first to us (we will respond within 30 days), and thereafter to the OAIC at [www.oaic.gov.au](https://www.oaic.gov.au).

**Cross-Border Disclosure:** We may disclose your personal information to overseas recipients (for example, Stripe for payment processing, and Google Analytics for analytics). Where we do so, we take reasonable steps to ensure the recipient handles your information consistently with the APPs. By using our Services, you consent to such cross-border disclosure in accordance with APP 8.

**Spam Act 2003 (Cth):** All commercial electronic messages (including marketing emails and SMS messages) sent by us comply with the _Spam Act 2003_ (Cth). Such messages will only be sent to recipients who have provided express or inferred consent, will clearly identify us as the sender, and will contain a functioning unsubscribe mechanism. We will honour all unsubscribe requests within 5 business days of receipt. You may unsubscribe at any time by clicking the unsubscribe link in any commercial message or by contacting us at [{{email}}](mailto:{{email}}). Unsubscribing from marketing communications does not affect transactional communications related to orders or account activity.

**Do Not Call Register:** We respect the _Do Not Call Register Act 2006_ (Cth). If you have registered your telephone number on the Australian Do Not Call Register, we will not make unsolicited telemarketing calls to that number.

### 13. Do We Make Updates to This Notice?

Yes. We may update this Privacy Notice from time to time to reflect changes in our practices, legal requirements, or for other operational reasons. The updated version will be indicated by an updated date at the top of this page. Material changes will be communicated to registered users via email where practicable. We encourage you to review this notice frequently.

### 14. How Can You Review, Update, or Delete Your Data?

To request to review, update, or delete your personal information, visit: [{{accountUrlDisplay}}]({{accountUrl}})

### 15. How Can You Contact Us About This Notice?

**Outback Electronics**

- {{address}}, Australia
- Phone: [{{phone}}](tel:{{phoneHref}})
- Email: [{{email}}](mailto:{{email}})

---

**Questions?** Email [{{email}}](mailto:{{email}}), we'll get back to you as soon as we can.`;

const BODY_SHIPPING = `_LEGAL · SHIPPING & DELIVERY POLICY_

## Shipping & Delivery Policy

This Shipping & Delivery Policy is part of our Terms and Conditions and should be read alongside our main Terms at [outbackelectronics.com.au/policies/terms-and-conditions](/policies/terms-and-conditions).

Please carefully review our Shipping & Delivery Policy when purchasing our products. This policy will apply to any order you place with us.

**Australian Consumer Law:** Nothing in this policy affects your rights as a consumer under the Australian Consumer Law. Our goods come with guarantees that cannot be excluded, including the guarantee that goods will be delivered within a reasonable time where no specific delivery date is agreed. For remote sales to consumers, the risk of loss of or damage to goods remains with us until the goods are delivered to you (or to a carrier nominated by you other than one we arranged).

**Third-Party Seller Orders:** Outback Electronics is a marketplace. Products sold by third-party sellers are dispatched directly by the seller from their own location. The sender name and address on the parcel will be the seller's, not Outback Electronics. If you are unsure who dispatched your order, check your order confirmation email. For any delivery issue with a third-party seller order, contact us at [{{email}}](mailto:{{email}}) and we will assist you in reaching the seller.

### What Are My Shipping & Delivery Options?

We currently offer the following shipping options:

- Standard Shipping (Australia Post, typically 2–8 business days within Australia)
- Express Shipping (Australia Post Express, typically 1–3 business days within Australia)

All times and dates given for delivery are estimates only and are given in good faith. We are not liable for delays caused by Australia Post, customs, or circumstances beyond our control, though we will keep you informed of any significant delay.

### Do You Deliver Internationally?

No. We currently ship only to addresses within Australia. We do not offer international shipping, and orders cannot be placed with a delivery address outside Australia.

### Are There Other Shipping Restrictions?

**Lithium and Regulated Batteries.** Lithium-ion, lithium-polymer, and certain other battery chemistries are classified as dangerous goods under the International Air Transport Association (IATA) Dangerous Goods Regulations, the International Civil Aviation Organization (ICAO) Technical Instructions, and the Civil Aviation Safety Authority (CASA) regulations for domestic Australian air freight. We do not offer air shipping for standalone batteries or battery-containing products that do not comply with applicable dangerous-goods transport requirements (including applicable watt-hour limits, packaging requirements, and state-of-charge restrictions). Standard ground shipping (Australia Post road network) may remain available for compliant battery products. If you are re-shipping or transporting batteries purchased from us, you are responsible for complying with all applicable dangerous-goods regulations in your jurisdiction.

**Other Dangerous Goods.** We do not ship items classified as dangerous goods (including certain chemicals, flammable liquids, compressed gases, aerosols, or other regulated materials) to international destinations or via air freight unless specifically permitted under applicable regulations. If your order contains restricted items, we will contact you before dispatch to discuss available shipping options or, if no compliant option exists, to cancel and refund that item.

### What Happens If My Order Is Delayed?

If delivery is delayed for any reason we will let you know as soon as possible and will advise you of a revised estimated delivery date.

### Backorders & Pre-orders

Some products are offered on backorder, meaning we do not hold the item in stock at the time you order it and will obtain it from our supplier or distributor once your order is placed. Backordered items are clearly marked as such on the product page and in your cart before you pay.

**Lead times are estimates.** Any lead time shown against a backordered item (for example 'ships in 3 weeks') is our good-faith estimate based on the supplier or distributor advice available to us at the time of listing. It is an estimate, not a guaranteed delivery date, and it is not a term of your contract with us. Supplier production runs, freight schedules, customs clearance, currency and stock allocation are outside our control and can move the date.

**What we commit to.** We will only offer an item on backorder where we have reasonable grounds to believe we can supply it within the estimate shown. If the estimate changes, we will contact you with a revised date as soon as our supplier advises us. We will not leave you waiting without an update.

**Your right to cancel.** You may cancel any backordered item that has not yet been dispatched, at any time and for any reason, for a full refund of the amount paid for that item to your original payment method. You do not need to wait for the estimate to pass, and you do not need to give a reason. If we tell you the lead time has blown out and you would rather not wait, cancel and we will refund you.

**Where an order contains both stocked and backordered items,** we will normally hold the order and ship it together unless you ask us to split it. Splitting an order may attract a second shipping charge, which we will tell you about before we do it.

**Payment.** Backordered items are paid for at the time of order. That payment secures your place in the queue for the incoming stock. It is refundable in full at any time before dispatch, as set out above.

**Australian Consumer Law.** Nothing in this section limits or excludes the consumer guarantees, including the guarantee that goods will be supplied within a reasonable time where no delivery date is agreed. Where a delay becomes unreasonable, your rights under the Australian Consumer Law, including the right to a refund, are unaffected. What this section does is make clear that a published lead-time estimate is an estimate given in good faith rather than a promised date, and that your remedy for a supplier delay is to cancel for a full refund rather than a claim for any loss the delay causes you.

### What If My Order Is Lost or Missing?

If your tracking information has not updated for more than 5 business days, or if it has been more than 5 business days past the estimated delivery date with no delivery, please contact us at [{{email}}](mailto:{{email}}) with your order number and tracking details. We will raise an enquiry with Australia Post or the relevant carrier on your behalf.

Where an order is confirmed as lost in transit, we will offer you a replacement or a full refund at your election, subject to stock availability for replacements. We will lodge any carrier claim on your behalf, you do not need to deal with the carrier directly.

**Signature on Delivery.** High-value orders may be dispatched with a signature-on-delivery requirement. If no one is available to sign at the time of delivery, a card will be left for redelivery or post office collection. We are not liable for packages left at an unattended delivery address where the carrier has confirmed delivery as per the applicable service terms and no signature was required.

**Incorrect Delivery Address.** You are responsible for providing a correct and complete delivery address at the time of order. We are not liable for delayed or failed delivery caused by an address error provided by you. If you notice an error immediately after placing your order, contact us at [{{email}}](mailto:{{email}}) as soon as possible; we will endeavour to correct it before dispatch but cannot guarantee we can do so.

### Questions About Returns?

If you have questions about returns, please review our Return Policy available on this site.

### How Can You Contact Us?

If you have any questions about this policy, please contact us at [{{email}}](mailto:{{email}}).

---

**Questions?** Email [{{email}}](mailto:{{email}}), we'll get back to you as soon as we can.`;

const BODY_COOKIE = `_LEGAL · COOKIE POLICY_

## Cookie Policy

This Cookie Policy explains how Outback Electronics ('Company', 'we', 'us', and 'our') uses cookies and similar technologies to recognise you when you visit our website at [outbackelectronics.com.au](https://outbackelectronics.com.au) ('Website'). It explains what these technologies are and why we use them, as well as your rights to control our use of them.

In some cases we may use cookies to collect personal information, or that becomes personal information if we combine it with other information.

### What Are Cookies?

Cookies are small data files placed on your computer or mobile device when you visit a website. Cookies are widely used by website owners to make their websites work, or work more efficiently, as well as to provide reporting information.

Cookies set by the website owner are called 'first-party cookies.' Cookies set by parties other than the website owner are called 'third-party cookies.' Third-party cookies enable third-party features or functionality to be provided on or through the website (e.g. analytics). The parties that set these third-party cookies can recognise your computer both when it visits this website and also when it visits certain other websites.

### Why Do We Use Cookies?

We use first- and third-party cookies for several reasons. Some cookies are required for technical reasons in order for our Website to operate, we refer to these as 'essential' or 'strictly necessary' cookies. Other cookies enable us to track and target the interests of our users to enhance their experience. Third parties serve cookies through our Website for analytics and other purposes.

### How Can I Control Cookies?

You have the right to decide whether to accept or reject cookies. You can set or amend your web browser controls to accept or refuse cookies. If you choose to reject cookies, you may still use our website though your access to some functionality and areas may be restricted.

### Essential Website Cookies

These cookies are strictly necessary to provide you with services available through our Website, such as maintaining your login session and protecting against cross-site request forgery.

| Cookie | Purpose | Type | Expires |
|---|---|---|---|
| \`oe_admin_session\` | Maintains your admin login session | server_cookie (HttpOnly, SameSite=Strict) | 8 hours |
| \`oe_portal_session\` | Maintains your customer portal and forum login session | server_cookie (HttpOnly, SameSite=Strict) | 30 days |
| \`_csrf\` | Protects against Cross-Site Request Forgery (CSRF) attacks | server_cookie (SameSite=Strict) | 24 hours |

### Performance and Functionality

We store your shopping cart locally in your browser to preserve it between visits. This data never leaves your device unless you proceed to checkout.

| Cookie | Purpose | Type | Expires |
|---|---|---|---|
| \`oe_cart\` | Stores your shopping cart items between visits | localStorage (client-side only) | Persistent until cleared |

### Analytics Cookies

We may use Google Analytics to understand how visitors interact with our Website. Google Analytics uses cookies to collect information such as how often users visit the site, what pages they visit, and what other sites they used prior to coming to our site. You can opt out of Google Analytics tracking at [tools.google.com/dlpage/gaoptout](https://tools.google.com/dlpage/gaoptout).

### How Can I Control Cookies on My Browser?

The means by which you can refuse cookies vary from browser to browser. Please visit your browser's help menu for more information. Links for the most popular browsers:

- [Chrome](https://support.google.com/chrome/answer/95647)
- [Internet Explorer / Edge](https://support.microsoft.com/en-us/windows/delete-and-manage-cookies-168dab11-0753-043d-7c16-ede5947fc64d)
- [Firefox](https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer)
- [Safari](https://support.apple.com/en-au/guide/safari/sfri11471/mac)
- [Opera](https://help.opera.com/en/latest/web-preferences/)

In addition, most advertising networks offer a way to opt out of targeted advertising. For more information please visit:

- [Digital Advertising Alliance](https://optout.aboutads.info/)
- [Digital Advertising Alliance of Canada](https://youradchoices.ca/)
- [European Interactive Digital Advertising Alliance](https://www.youronlinechoices.eu/)

### What About Other Tracking Technologies?

Cookies are not the only way to recognise or track visitors. We may use other similar technologies from time to time, like web beacons (sometimes called 'tracking pixels' or 'clear gifs'). These are tiny graphics files that contain a unique identifier that enables us to recognise when someone has visited our Website or opened an email. In many instances, these technologies are reliant on cookies to function properly, and so declining cookies will impair their functioning.

### Do You Serve Targeted Advertising?

Third parties may serve cookies on your computer or mobile device to serve advertising through our Website. These companies may use information about your visits to this and other websites to provide relevant advertisements about goods and services you may be interested in. The information collected through this process does not enable us or them to identify your name, contact details, or other personally identifying information unless you choose to provide these.

### How Often Will You Update This Cookie Policy?

We may update this Cookie Policy from time to time to reflect changes to the cookies we use or for other operational, legal, or regulatory reasons. Please revisit this Cookie Policy regularly to stay informed. The date at the top of this Cookie Policy indicates when it was last updated.

### Where Can I Get Further Information?

If you have any questions about our use of cookies or other technologies, please contact us at [{{email}}](mailto:{{email}}).

---

**Questions?** Email [{{email}}](mailto:{{email}}), we'll get back to you as soon as we can.`;

const BODY_RETURN_PRIVATE = `_LEGAL · RETURN POLICY_

## Return Policy

Thank you for your purchase. We hope you are happy with it. However, if you are not completely satisfied for any reason, you may return it for a full refund or exchange. Please see below for more information on your rights and our process.

**Third-Party Seller Products:** Outback Electronics is a marketplace. If your product was sold by a third-party seller, your return must go back to that seller - not to Outback Electronics. Your order confirmation will identify the seller. Contact us at [{{email}}](mailto:{{email}}) if you need help identifying the seller or facilitating a return. The return address and process below applies only to products sold directly by Outback Electronics.

### Australian Consumer Law - Your Statutory Rights

Our products come with guarantees that cannot be excluded under the Australian Consumer Law. You are entitled to a replacement or refund for a major failure and compensation for any other reasonably foreseeable loss or damage. You are also entitled to have the goods repaired or replaced if the goods fail to be of acceptable quality and the failure does not amount to a major failure.

**These rights apply regardless of, and are in addition to, our voluntary change-of-mind policy below.** Nothing in this policy excludes, restricts, or modifies any right or remedy you have under the Australian Consumer Law.

For warranty claims or ACL issues (e.g. goods not of acceptable quality, not fit for purpose, or not matching description), contact us at [{{email}}](mailto:{{email}}). There is no set time limit for statutory guarantee claims, they apply for a reasonable period depending on the nature of the goods.

### Dead on Arrival (DOA) - Goods Not Working on Receipt

If your item arrives and does not function at all upon first use ('Dead on Arrival' or 'DOA'), please contact us within **48 hours of delivery** at [{{email}}](mailto:{{email}}). Include your order number, a description of the issue, and photographs or video evidence where possible. Subject to assessment, we will arrange a replacement, repair, or full refund as required by the Australian Consumer Law, at your election for a major failure.

Your statutory rights under the Australian Consumer Law are not limited by this 48-hour notification window, this is our preferred process for handling DOA claims efficiently. If you miss this window, your ACL rights to a remedy for defective goods still apply in full.

### Items Damaged in Transit

We take care in packaging all orders, but damage can occur during transit. If your order arrives damaged:

- Do not discard any packaging, it may be required for a carrier claim.
- Photograph or video the outer packaging and the damaged item before unpacking further.
- Contact us within **48 hours of delivery** at [{{email}}](mailto:{{email}}) with your order number and photographic evidence.

We will arrange a replacement, repair, or refund as required. Where damage was caused by the carrier, we will lodge a claim with Australia Post or the relevant carrier on your behalf. You may be required to retain damaged packaging and the item for inspection.

### Products Posing a Safety Hazard

**If you receive a product that you believe poses an immediate safety hazard, including a product that is sparking, smoking, leaking fluid, swelling, emitting unusual heat, or emitting chemical odours - do not use it. Disconnect it from power immediately if it is safe to do so. Keep it away from flammable materials.**

Contact us immediately by phone at [{{phone}}](tel:{{phoneHref}}) or by email at [{{email}}](mailto:{{email}}). We will arrange return or inspection as a priority, ahead of any standard returns process. If there is any immediate risk to life or property, call 000 first.

Your rights under the Australian Consumer Law in relation to unsafe goods are not limited by this policy. You may also report a dangerous product to the ACCC Product Safety website at [www.productsafety.gov.au](https://www.productsafety.gov.au).

### Change-of-Mind Returns

In addition to your statutory rights, we accept change-of-mind returns postmarked within **seven (7) days** of the date of delivery. All returned items must be in new and unused condition, with all original packaging, tags, seals, and labels intact and undamaged. We are not required by law to offer this voluntary policy and it does not affect or limit your ACL rights in any way.

### Return Process

To return an item, please email customer service at [{{email}}](mailto:{{email}}) to obtain a Return Merchandise Authorisation (RMA) number. After receiving your RMA number you have two options:

- **Mail-in (accepted any time, no appointment needed):** Pack the item securely in its original packaging, include proof of purchase and your RMA number, and post to:

  **Outback Electronics** - Attn: Returns (RMA # [your number])
  {{address}}, Australia

- **In-person drop-off (by prior appointment only):** Contact us to arrange a suitable time before attending. We do not accept unannounced walk-in returns.

For **change-of-mind returns**, you are responsible for return shipping charges. We strongly recommend using a trackable method. For returns under your ACL statutory rights (e.g. faulty goods), we will cover reasonable return shipping costs.

### Refunds

After receiving your return and inspecting the condition of your item, we will process your return. Please allow at least **seven (7) days** from receipt of your item for processing. Refunds will be issued via your original payment method. Card refunds may take 1–2 billing cycles to appear on your statement depending on your card issuer. We will notify you by email when your return has been processed.

### Repair Services - Warranty Returns

_Our repair services cover ELV (Extra Low Voltage, ≤50 V AC / ≤120 V DC) and LV equipment - including PCs, phones, tablets, microcontroller boards, and embedded systems. We do not repair mains-connected appliances or perform mains wiring._

**Repair Warranty Period.** Our repair work is warranted for **90 days from the date of completion**. If the same fault that was repaired reoccurs within the Repair Warranty Period, contact us at [{{email}}](mailto:{{email}}) and we will re-examine and re-repair at no charge, or provide an alternative remedy as required by the Australian Consumer Law.

**What the Repair Warranty Covers.** The Repair Warranty covers the specific fault addressed in the agreed repair. It does not cover: (a) faults unrelated to the repair performed; (b) damage caused by misuse, accidental damage, liquid ingress, or physical impact after collection; (c) damage caused by a pre-existing condition separate from the agreed repair; or (d) further modification or repair by the customer or a third party after collection from us.

**Repairs to Second-Hand or Used Devices.** Where the device you submit for repair is itself second-hand or used (including devices purchased from us as 'Used' or 'Refurbished' stock, traded in, or otherwise acquired second-hand), the Repair Warranty above applies to **our repair work only**, it does not extend, restore, or create any warranty over the device as a whole, and does not cover faults, wear, or failures unrelated to the specific repair performed. The device's separate product warranty (if any) is governed by its own terms, including our Return Policy's used/refurbished goods provisions, and is not affected by the existence of a Repair Warranty on unrelated work.

**Your ACL Rights for Repair Services.** If our Repair Services fail to comply with a consumer guarantee under the Australian Consumer Law (e.g., not carried out with due care and skill), you are entitled to a remedy under the ACL, which may include re-performance of the service or compensation for foreseeable loss. These rights apply regardless of, and in addition to, our Repair Warranty.

### Exceptions (Change-of-Mind Returns Only)

The following items are excluded from our voluntary change-of-mind return policy:

- Software (once opened or downloaded)
- Digital files and downloadable content
- Services (once performed)
- Custom or bespoke jobs

**Please note:** These exclusions do not affect your rights under the Australian Consumer Law. If any of these items are faulty, not as described, or not fit for purpose, your statutory rights still apply - contact us to arrange a remedy.

For defective or damaged products (any category), please contact us at the details below to arrange a repair, replacement, or refund as required by law.

### Questions

If you have any questions concerning our return policy or your rights under the Australian Consumer Law, please contact us at:

Phone: [{{phone}}](tel:{{phoneHref}})
Email: [{{email}}](mailto:{{email}})

You can also obtain information about your consumer rights from the Australian Competition and Consumer Commission (ACCC) at [www.accc.gov.au](https://www.accc.gov.au) or Queensland Office of Fair Trading at [www.qld.gov.au/law/fair-trading](https://www.qld.gov.au/law/fair-trading).

---

**Questions?** Email [{{email}}](mailto:{{email}}), we'll get back to you as soon as we can.`;

const BODY_TERMS_COMMERCIAL = `_LEGAL · COMMERCIAL TERMS AND CONDITIONS_

## Terms and Conditions - Commercial Customers

These Commercial Terms and Conditions apply to any purchase from Outback Electronics ('Company', 'we', 'us', or 'our') made by a business, trade, or wholesale account, or otherwise made for the purposes of resupply, business use, or in trade ('Commercial Customer', 'you'). If you are purchasing as a private individual mainly for personal, domestic, or household use, our standard [Terms and Conditions for Private Customers](/policies/private/terms-and-conditions) apply instead.

We are Outback Electronics, a mobile electronics services provider registered in Australia. Our ABN is {{abn}}. Our correspondence and returns address is {{address}}, Australia. You can contact us by phone at [{{phone}}](tel:{{phoneHref}}) or by email at [{{email}}](mailto:{{email}}).

**BY PLACING A COMMERCIAL OR TRADE ORDER WITH US, YOU REPRESENT THAT YOU ARE ACQUIRING THE GOODS OR SERVICES FOR BUSINESS USE OR RESUPPLY AND YOU AGREE TO BE BOUND BY THESE COMMERCIAL TERMS IN PLACE OF OUR PRIVATE CUSTOMER TERMS.**

### 1. Application and Precedence

These Commercial Terms apply to the exclusion of our standard private-customer Terms and Conditions wherever an order is placed on a trade or business account, in quantities or at prices consistent with wholesale or resupply, or where the customer identifies itself as a business at checkout or in account setup. Our Privacy Policy, Cookie Policy, and Acceptable Use Policy apply equally to Commercial Customers and are incorporated by reference.

### 2. Consumer Guarantees and Business Purchases

The Australian Consumer Law ('ACL') consumer guarantees apply to goods and services acquired by a 'consumer' as defined in section 3 of the ACL. Depending on the value and nature of the goods, some business purchases - particularly higher-value purchases, or goods not of a kind ordinarily acquired for personal, domestic, or household use - may fall outside the ACL's consumer guarantee regime and are instead governed by the contractual warranties set out in these Commercial Terms.

**Nothing in these Commercial Terms excludes, restricts, or modifies any guarantee, right, or remedy that applies as a matter of law and cannot lawfully be excluded**, including any ACL consumer guarantee that does apply to your purchase. Where the ACL consumer guarantees do not apply to your purchase, the warranties in clause 6 below apply in their place.

### 3. Trade Accounts and Credit

Trade accounts may be approved at our discretion. Where a credit account is approved, payment terms (e.g. 14 or 30 days from invoice) will be confirmed in writing at account setup. Invoices not paid by the due date may attract interest at 1.5% per month (or part thereof) on the overdue balance, and we may suspend supply on the account until overdue amounts are paid. We reserve the right to require security, a deposit, or payment in advance for any order, and to vary, suspend, or withdraw credit terms at any time on reasonable notice.

Title in goods does not pass to you until payment in full has been received by us in cleared funds. Until title passes, you must store the goods separately, keep them identifiable as our property, and not encumber or sell them other than in the ordinary course of resupply.

### 4. Pricing, Quotes, and Bulk Orders

Trade and wholesale pricing is provided on request and may vary by volume, account history, or negotiated arrangement. Written quotes are valid for 14 days from issue unless otherwise stated and are subject to stock availability at the time of order confirmation. All prices are in Australian Dollars and exclude GST unless stated otherwise. OE is not currently registered for GST, so no GST is currently added to trade or wholesale prices; if OE becomes GST-registered, GST will be added and shown on the invoice from that date.

### 5. Delivery and Risk

Estimated delivery times are not guaranteed. Risk in the goods passes to you on delivery to the address you nominate, or on collection if you arrange your own freight or pick-up. You are responsible for inspecting goods on delivery and notifying us in writing of any shortage, transit damage, or discrepancy within 5 business days of delivery; claims made after this period may not be accepted, except to the extent the ACL or other mandatory law requires otherwise.

### 6. Warranty (Where ACL Consumer Guarantees Do Not Apply)

Where the ACL consumer guarantees do not apply to your purchase under clause 2, we warrant that goods supplied will be free from material defects in materials and workmanship for a period of **12 months from the date of delivery** ('Commercial Warranty'), or such other period as agreed in writing for a specific order. Our sole obligation under the Commercial Warranty, at our election, is to repair, replace, or credit the price of any defective goods returned to us at your cost within the warranty period, provided the defect is not the result of misuse, unauthorised modification, incorrect installation, normal wear and tear, or use outside the goods' rated specifications.

To the fullest extent permitted by law, the Commercial Warranty is the sole and exclusive remedy for defective goods supplied under these Commercial Terms, and excludes any other warranty, condition, or guarantee, whether express, implied, statutory, or otherwise, except any guarantee that applies as a matter of law and cannot lawfully be excluded.

### 7. Returns

Please refer to our [Return Policy for Commercial Customers](/policies/commercial/return-policy), which forms part of these Commercial Terms.

### 8. Resupply, Relabelling, and Representations to End Customers

If you resell or resupply our products, you are solely responsible for any representations you make to your own customers about those products, and for complying with the ACL and any other applicable law in respect of your own sales. You must not represent that we warrant, endorse, or are responsible for any modification, integration, relabelling, or bundling you apply to our products. You agree to indemnify us against any claim arising from a representation you make to your customers that is inconsistent with these Commercial Terms or our published product specifications.

### 8A. Subscriptions

Where you take out a membership, subscription, or recurring trade account billing arrangement with us, it auto-renews on the agreed cycle unless cancelled. A free trial, where offered, is available once per business, regardless of how many accounts or related entities you operate; we may decline a further trial, or convert it to a paid subscription, where we reasonably believe you have already received one. Cancellation takes effect at the end of the current paid period, and you retain access to any tier-gated benefits already paid for until that date. If we discontinue a tier or its benefits, we will give reasonable notice and either migrate you to a comparable tier or credit the unused, already-paid portion of the period on a pro-rata basis.

### 8B. Software and AI Assistant

Any software we supply is offered 'AS IS' without warranty of any kind beyond the Commercial Warranty in clause 6, except where a EULA accompanies the software, in which case the EULA governs to the extent of any inconsistency. Where we provide an AI-powered chat or assistant feature, your input may be transmitted to and processed by a third-party AI service provider to generate a response; do not submit confidential, commercially sensitive, or personal information to it. AI Assistant output is generated automatically, may be inaccurate or incomplete, does not constitute professional or technical advice, and must be independently verified before you rely on it for any business purpose. To the fullest extent permitted by law, we are not liable for any loss arising from your reliance on AI Assistant output or from a firmware/software update, except as required by the ACL where it applies.

### 8C. Security, Penetration-Testing, and Similar Dual-Use Tools

Some software we supply is designed for security research, penetration testing, network diagnostics, or similar dual-use purposes ('Security Tools'). Security Tools are supplied strictly for use on systems and networks your business owns, or for which your business holds documented authorisation (such as a signed penetration-testing engagement letter). You must comply with the _Criminal Code Act 1995_ (Cth), the _Cybercrime Act 2001_ (Cth), and all other applicable laws governing computer access in any jurisdiction in which the Security Tool is used.

If we reasonably suspect a Security Tool we have supplied is being used for an unauthorised or unlawful purpose, we may report the matter - including disclosing your business and personal information, to law enforcement, a regulator, or an affected third party without notice. To the fullest extent permitted by law, we are not liable for any loss, claim, fine, or legal liability arising from use of a Security Tool for any illegal, unethical, or unauthorised purpose, and you indemnify us against any such claim.

### 9. Limitation of Liability

**TO THE FULLEST EXTENT PERMITTED BY LAW, OUR TOTAL AGGREGATE LIABILITY TO YOU UNDER OR IN CONNECTION WITH THESE COMMERCIAL TERMS, WHETHER IN CONTRACT, TORT (INCLUDING NEGLIGENCE), OR OTHERWISE, IS LIMITED TO THE PRICE PAID BY YOU FOR THE GOODS OR SERVICES GIVING RISE TO THE CLAIM. WE ARE NOT LIABLE FOR ANY INDIRECT, CONSEQUENTIAL, OR ECONOMIC LOSS, INCLUDING LOSS OF PROFITS, LOSS OF CONTRACTS, OR LOSS OF BUSINESS OPPORTUNITY, ARISING OUT OF OR IN CONNECTION WITH THESE COMMERCIAL TERMS.**

**This limitation does not apply to liability that cannot lawfully be excluded or limited, including liability arising under any ACL consumer guarantee that does apply to your purchase.**

### 10. Governing Law and Disputes

These Commercial Terms are governed by the laws of Queensland, Australia. Each party submits to the exclusive jurisdiction of the courts of Queensland in respect of any dispute arising out of or in connection with these Commercial Terms, except where mandatory law provides otherwise.

### 11. Contact Us

**Outback Electronics**

- {{address}}, Australia
- Phone: [{{phone}}](tel:{{phoneHref}})
- Email: [{{email}}](mailto:{{email}})

---

**Questions?** Email [{{email}}](mailto:{{email}}), we'll get back to you as soon as we can.`;

const BODY_RETURN_COMMERCIAL = `_LEGAL · RETURN POLICY - COMMERCIAL CUSTOMERS_

## Return Policy - Commercial Customers

This Return Policy applies to purchases made on a trade, wholesale, or business account. If you are a private customer purchasing mainly for personal or household use, our [standard Return Policy](/policies/private/return-policy) applies instead.

### Statutory Rights

Where the Australian Consumer Law consumer guarantees apply to your purchase (see clause 2 of our Commercial Terms and Conditions), nothing in this policy excludes, restricts, or modifies those rights. For purchases outside the scope of the ACL consumer guarantees, the Commercial Warranty described in our Commercial Terms and Conditions applies in their place.

### Faulty or Defective Goods

If goods are defective on arrival or fail within the applicable warranty period, contact us at [{{email}}](mailto:{{email}}) with your account or invoice number, a description of the fault, and supporting photographs or video where possible. We will assess the claim and, where the goods are confirmed defective, repair, replace, or credit them in accordance with our Commercial Terms and Conditions.

### Change-of-Mind Returns - No General Right

Unlike our private-customer policy, we do **not** offer a general change-of-mind return right on commercial or trade orders, including bulk and made-to-order stock. Any change-of-mind return is at our sole discretion, must be agreed with us in writing before the goods are sent back, and may be subject to a restocking fee of up to 20% of the invoice value plus return freight, deducted from any credit issued. Goods must be unused, in original packaging, and in resaleable condition to be accepted for a discretionary change-of-mind return.

### Shortages and Transit Damage

Shortages, incorrect items, or transit damage must be reported in writing within **5 business days** of delivery, with photographic evidence of the goods and packaging as received. Claims reported after this period may not be accepted, except to the extent required by the ACL or other mandatory law.

### Return Process

Email [{{email}}](mailto:{{email}}) to obtain a Return Merchandise Authorisation (RMA) number before sending anything back. Goods returned without a prior RMA number may be refused or delayed. Unless the return relates to a confirmed defect or an error on our part, you are responsible for return freight, which must be sent prepaid to:

**Outback Electronics** - Attn: Trade Returns (RMA # [your number])
{{address}}, Australia

### Credits and Refunds

Approved returns are processed as an account credit by default. A refund to your original payment method, or to your nominated bank account for invoiced trade accounts, will be issued on request once the returned goods have been received and inspected. Please allow up to 14 business days for processing.

### Questions

Phone: [{{phone}}](tel:{{phoneHref}})
Email: [{{email}}](mailto:{{email}})

---

**Questions?** Email [{{email}}](mailto:{{email}}), we'll get back to you as soon as we can.`;

const BODY_CUSTOM_WORK = `_LEGAL · CUSTOM WORK AND REVERSE ENGINEERING POLICY_

## Custom Work and Reverse Engineering Policy

This policy applies whenever Outback Electronics ('Company', 'we', 'us', or 'our') designs or builds bespoke hardware, writes or modifies custom software or firmware, performs reverse-engineering work, performs digital forensics or data recovery work, or installs CCTV or security camera systems (collectively, 'Custom Work') for a customer ('you'). It applies alongside, and in addition to, our Terms and Conditions (private or commercial, as applicable) and our Acceptable Use Policy. Our ABN is {{abn}}. Contact us at [{{phone}}](tel:{{phoneHref}}) or [{{email}}](mailto:{{email}}) with any questions before commencing a Custom Work job.

### 1. Quote and Scope

Before we start any Custom Work, we will agree a written quote or statement of work describing the scope, deliverables, fees, and timeline. Work outside this agreed scope ('Change Requests') must be confirmed in writing and may incur additional fees or affect the timeline. Verbal or informal requests made during the course of a job are treated as Change Requests and are not binding until confirmed in writing.

### 2. Ownership of Deliverables - We Retain IP, You Get a Licence

**Before you accept a quote or statement of work, we will draw your attention to this clause** so you understand, before work begins, that paying for a Custom Work job gives you a licence to use the Deliverable rather than ownership of the underlying intellectual property. This is particularly important for commercial customers commissioning work for resupply or integration into their own products, if you need ownership or a broader licence, raise it with us before the job starts, not after delivery.

Unless we agree otherwise in writing for a specific job, **we retain ownership of all intellectual property** in the deliverables created in performing Custom Work, including schematics, PCB layouts, firmware, source code, designs, drawings, and documentation ('Deliverables').

On payment in full for the job, we grant you a **non-exclusive, non-transferable, perpetual licence** to use, operate, and maintain the Deliverable for your own internal or personal purposes, and to have it repaired or modified by us or (where we provide the necessary materials, such as source files) a third party. This licence does **not** include the right to resell, sublicense, manufacture at volume, distribute, or commercially exploit the Deliverable or any copy or derivative of it. If you want to do any of those things, contact us to discuss a separate commercialisation licence, fees and terms for that are negotiated separately and are not covered by this policy.

We may reuse general techniques, methods, and know-how developed during your job in other jobs for other customers. We will not disclose your specific designs, source code, or confidential information to another customer, see clause 6 (Confidentiality). Where a job involves recreating or replicating the functionality of a third-party product or tool that is itself publicly available (for example, a reverse-engineered replacement for commercial software), our default position is that the recreation itself is not your confidential information merely because the original product is publicly available, and we may offer similar recreations to other customers. **This default does not apply, and any separate written agreement for the job prevails over it,** where a specific contract, statement of work, or non-disclosure agreement for that job restricts our ability to do so, including where we are engaged as a subcontractor under an NDA that covers the deliverable, the engagement itself, or the surrounding business context. In every case, this reuse right (whether under the general know-how rule above or this clause) is subject to, and does not override, any separate confidentiality or non-disclosure agreement we have entered into with a third party. Where we hold information under such an agreement, we will not use or disclose it in performing work for you, even if it would otherwise qualify as general know-how or a publicly-available recreation.

No licence is granted, and no Deliverable will be released to you, until the job is paid in full. We may withhold source files, firmware images, or design files (while still providing the finished physical item, where applicable) until payment is received, unless a specific quote or statement of work for the job otherwise agrees to deliver source files or design files on a different basis, in which case that written agreement prevails over this clause for that job.

### 3. Reverse Engineering - Your Warranty

If you ask us to reverse-engineer an item, including recreating a circuit or board, extracting or decompiling firmware, recovering a design with no remaining documentation, or cloning a part that is no longer manufactured, you warrant to us that:

- you own the item, or are its lawful licensee or authorised user with the right to have it serviced, repaired, or made interoperable with other equipment;
- the request is for a legitimate purpose such as repair, maintenance, interoperability, or preservation of a product you are entitled to use, and not for unauthorised cloning of a current commercial product for competing manufacture or resale;
- you are not aware of any patent, registered design, copyright, or trade mark rights that would prevent the requested work, and have not been told by any third party that the item or its underlying design is subject to such rights; you do not breach, and have no reason to believe the work would breach, the anti-circumvention provisions of the _Copyright Act 1968_ (Cth) or any other applicable law; and
- you have not misrepresented your relationship to, or rights in, the item.

We recognise that most customers cannot exhaustively verify patent or design-registration status before requesting reverse-engineering work, which is why this warranty is limited to what you are actually aware of or have been told, rather than requiring you to conduct a search.

To the extent permitted by law, you indemnify us against any claim, loss, or liability arising from reverse-engineering work we perform at your request where any part of this warranty is false.

### 4. Our Right to Decline or Stop a Job

We are not lawyers and do not provide legal advice on whether a specific reverse-engineering or custom-build request is lawful in your circumstances. As a matter of our own business discretion, we may decline to accept, or stop work part-way through, any job that appears to us to involve: circumventing a technological protection measure (such as DRM or device locking) for a purpose other than lawful repair or interoperability; cloning a current commercial product for the purpose of competing manufacture or resale; infringing an obvious and apparent patent, registered design, or trade mark; or any other request that raises an apparent red flag for unauthorised use of a third party's intellectual property. Declining or stopping a job under this clause is a business decision, not a legal determination, and does not constitute legal advice to you about the lawfulness of your request. If we stop a job already in progress under this clause, we will refund fees paid for work not yet performed, but are not liable for any other loss arising from the job not being completed.

If you would like independent advice on whether a particular reverse-engineering or custom-build request is lawful, you should consult a qualified intellectual property lawyer before asking us to proceed.

### 5. Risks Specific to Custom and Reverse-Engineered Work

Custom hardware, custom software, and reverse-engineered designs are, by their nature, novel, one-off, or recreated without the benefit of original manufacturer documentation, testing, or certification. The following apply in addition to the general disclaimers in our Terms and Conditions and Disclaimer:

- **No regulatory certification implied.** Unless we expressly agree in writing to obtain a specific certification (e.g. RCM) for a Deliverable, Custom Work is supplied uncertified. You are responsible for arranging any compliance testing or certification required before deploying a Deliverable commercially or in a regulated environment.
- **Not a medical device; not safety-certified.** Custom Work is not designed, tested, or certified as a medical device under the _Therapeutic Goods Act 1989_ (Cth) or any other medical device regulatory framework, and must not be used for diagnosis, treatment, monitoring, or any other medical purpose unless we expressly agree in writing to develop the Deliverable to that standard (which involves a separate, materially different scope, cost, and regulatory pathway). The same applies to any other safety-critical regulated application (e.g. aviation, automotive safety systems). Using a Deliverable for a medical or other safety-critical regulated purpose without our express written agreement to that scope is entirely at your own risk.
- **ELV/LV scope only.** As with all our services, Custom Work is limited to Extra Low Voltage (≤50 V AC / ≤120 V DC) and Low Voltage equipment. We do not design, build, or reverse-engineer mains-voltage (240 V AC) hardware.
- **Prototype-grade reliability.** One-off and recreated designs may contain faults or limitations not apparent at delivery, including faults inherited from incomplete or imperfect reverse-engineering of the original item. We are not liable for faults arising from the inherent limitations of recreating a design without complete original documentation, beyond the workmanship warranty in clause 7.
- **Not validated for safety-critical or production deployment.** Unless expressly agreed in writing, Custom Work is not validated for use in safety-critical applications or volume production. You should have a Deliverable independently assessed before such use.

### 6. Confidentiality

We will keep confidential any proprietary information, designs, or materials you provide to us for a Custom Work job, and will not disclose them to other customers or third parties except: as needed to perform the job (e.g. component suppliers); as required by law; or with your written consent. You should clearly mark any materials you consider confidential. This clause survives completion of the job.

Where you and we have entered into a separate non-disclosure agreement for a job, we will only disclose information covered by that agreement where we are legally compelled to do so, for example, in response to a court order, subpoena, summons, or other binding legal process (including being required to give evidence or testimony in connection with legal proceedings involving you). Where legally permitted to do so, we will give you reasonable notice before making any such disclosure so you have the opportunity to object or seek a protective order. We will not disclose NDA-covered information on the basis of an informal request, a request from a party other than a court or regulator with legal authority to compel disclosure, or our own discretion.

### 7. Warranty on Custom Work

We warrant that Custom Work will be performed with due care and skill and will conform to the agreed written scope. For private customers, this is in addition to your rights under the Australian Consumer Law, which are not excluded. For commercial customers, the Commercial Warranty in our Commercial Terms and Conditions applies in place of ACL consumer guarantees where those guarantees do not apply to your purchase. This warranty does not cover faults arising from the inherent limitations described in clause 5, from your own specifications or design input, or from modification or further work by you or a third party after delivery.

**Nothing in this policy excludes, restricts, or modifies any right or remedy you have under the Australian Consumer Law, or any other applicable law, that cannot lawfully be excluded, restricted, or modified.**

### 7A. Limitation of Liability

To the maximum extent permitted by law, our total liability arising out of or in connection with Custom Work performed for you, whether in contract, tort (including negligence), or otherwise, is limited to the fees paid by you for the relevant job. We are not liable for any indirect, consequential, or economic loss, including loss of profits, loss of contracts, or loss of business opportunity, arising out of or in connection with Custom Work.

This limitation does not apply to liability that cannot lawfully be excluded or limited, including any ACL consumer guarantee that applies to your purchase, or to our indemnity obligations under clause 3.

### 7B. Digital Forensics and Data Recovery - Your Warranty

If you ask us to perform digital forensics, data recovery, or extraction of data from a computer, phone, storage media, or embedded device, you warrant to us that:

- you own the device or data, or you have the lawful authority of the owner, your employer (for a work-issued device, in accordance with your organisation's policies), or a court order or other legal process to have it examined;
- the request is not intended to monitor, track, or access another person's device, accounts, or communications without their knowledge or consent, except where you have a clear legal basis to do so (for example, as a parent/guardian of a minor, an employer accessing a company-owned device in accordance with workplace policy, or a court-ordered or law-enforcement-directed examination); and
- you will not use anything we recover or provide to harass, stalk, blackmail, or otherwise harm another person.

Where you have asked us to prepare evidence-grade documentation (for example, for use in legal proceedings), we will take reasonable steps to document our methodology and the chain of custody of the device or media while in our possession, but we do not guarantee that our documentation will meet the evidentiary standard of any particular court, tribunal, or jurisdiction, and you should obtain independent legal advice on evidentiary requirements before relying on it. We retain recovered data only as long as reasonably necessary to complete the job and deliver it to you, after which we securely delete it unless you ask us in writing to retain it for a further agreed period.

If we reasonably suspect a forensics or data recovery request is intended to facilitate stalking, domestic violence, unauthorised surveillance, or another unlawful purpose, we may decline or stop the job under clause 4, and may report the matter to police without notice to you. To the extent permitted by law, you indemnify us against any claim, loss, or liability arising from a forensics or data recovery job we perform at your request where any part of this warranty is false.

### 7C. CCTV and Security Camera Installations

If you engage us to install or configure a CCTV or other security camera system, you are solely responsible for ensuring the system's placement, recording, and use complies with the _Surveillance Devices Act_ (or equivalent legislation) of your state or territory, including any requirement to obtain consent before recording in an area where a person has a reasonable expectation of privacy, and any signage or notification requirements that apply to your premises. We will advise you of obvious compliance issues we notice during installation (for example, a camera angled into a neighbouring private property or a shared bathroom), but we are not lawyers and installing a system at your direction is not advice that the resulting use is lawful.

To the fullest extent permitted by law, we are not liable for your use of an installed system in a manner that breaches applicable surveillance or privacy law, and you indemnify us against any claim arising from such use. We may decline to install a camera in a location or configuration that, in our reasonable opinion, is clearly intended for covert surveillance of another person without a lawful basis.

### 8. Cancellation

If you cancel a Custom Work job after we have started, you remain liable for fees for work already performed and for any non-returnable materials already ordered for the job. Deposits paid are applied against work performed and are non-refundable to the extent work has commenced, except as required by the Australian Consumer Law.

### 9. Contact Us

**Outback Electronics**

- {{address}}, Australia
- Phone: [{{phone}}](tel:{{phoneHref}})
- Email: [{{email}}](mailto:{{email}})

---

**Questions?** Email [{{email}}](mailto:{{email}}), we'll get back to you as soon as we can.`;

const BODY_DISCLAIMER = `_LEGAL · DISCLAIMER_

## Disclaimer

This Disclaimer forms part of our Terms and Conditions. By accessing or using this Site in any way, you accept this Disclaimer in full. If you do not accept this Disclaimer, you must immediately cease using this Site.

### General Website Disclaimer

The information provided by Outback Electronics ('we', 'us', or 'our') on [outbackelectronics.com.au](https://outbackelectronics.com.au) (the 'Site') is for general informational purposes only. All information on the Site is provided in good faith; however, we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information on the Site.

**TO THE FULLEST EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY LOSS OR DAMAGE OF ANY KIND WHATSOEVER - INCLUDING BUT NOT LIMITED TO INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES - INCURRED AS A RESULT OF: (A) YOUR USE OF OR INABILITY TO USE THE SITE; (B) YOUR RELIANCE ON ANY INFORMATION OBTAINED FROM THE SITE; OR (C) ANY ERROR, OMISSION, INTERRUPTION, DELETION, DEFECT, DELAY IN OPERATION, COMPUTER VIRUS, UNAUTHORISED ACCESS, OR OTHER TECHNICAL FAILURE. YOUR USE OF THE SITE AND YOUR RELIANCE ON ANY INFORMATION ON THE SITE IS SOLELY AT YOUR OWN RISK.**

**Nothing in this Disclaimer excludes, restricts, or modifies any consumer guarantee, right, or remedy conferred by the Australian Consumer Law (Schedule 2 of the Competition and Consumer Act 2010 (Cth)) or any other applicable mandatory legislation that cannot lawfully be excluded or limited.**

### Technical Information Disclaimer

Any technical information, repair guides, product specifications, tutorials, forum posts, or other technical content available on this Site are provided for general informational purposes only. They do not constitute professional engineering, electrical safety, or specialist advice. Our content relates exclusively to ELV (Extra Low Voltage, ≤50 V AC / ≤120 V DC) and LV equipment - nothing on this Site should be read as guidance for mains-voltage (240 V AC) work. Electronic repairs, modifications, and electrical work involve inherent and serious risks, including, without limitation: **electric shock capable of causing death or permanent serious injury; fire and explosion that may result in partial or complete destruction of property (including your home or premises); toxic gas release from damaged or mishandled battery cells; damage to connected equipment and infrastructure; personal injury; and voiding of manufacturer warranties**. Following any guide or tutorial on this Site does not guarantee safety, accuracy, or a successful outcome for your specific device, application, component selection, or environment. Always verify technical information from authoritative sources and consult a qualified professional where appropriate.

**YOU ASSUME ALL RISK AND RESPONSIBILITY FOR ANY ACTIONS TAKEN IN RELIANCE ON TECHNICAL INFORMATION OBTAINED FROM THIS SITE, INCLUDING WITHOUT LIMITATION ANY REPAIR GUIDES, TUTORIALS, FORUM POSTS, OR PRODUCT DESCRIPTIONS. WE SHALL HAVE NO LIABILITY WHATSOEVER FOR ANY LOSS, DAMAGE, PERSONAL INJURY, SERIOUS BODILY INJURY, DEATH, FIRE, EXPLOSION, PROPERTY DAMAGE (INCLUDING TOTAL OR PARTIAL LOSS OF YOUR HOME OR PREMISES), CONSEQUENTIAL HARM, OR OTHER ADVERSE OUTCOME RESULTING FROM YOUR USE OF OR RELIANCE ON ANY TECHNICAL INFORMATION ON THIS SITE, WHETHER ARISING FROM NEGLIGENCE OR OTHERWISE. YOU SHOULD ALWAYS CONSULT A QUALIFIED PROFESSIONAL - AND IN AUSTRALIA, A LICENSED ELECTRICIAN FOR ANY MAINS-VOLTAGE WORK - BEFORE UNDERTAKING ANY ELECTRICAL OR ELECTRONIC REPAIR, MODIFICATION, OR INSTALLATION.**

**Nothing in this Technical Information Disclaimer excludes, restricts, or modifies any consumer guarantee, right, or remedy conferred by the Australian Consumer Law or any other applicable mandatory legislation that cannot lawfully be excluded.**

### Scope of Our Work

**⚠ IMPORTANT: Outback Electronics works exclusively with Extra Low Voltage (ELV, ≤50 V AC / ≤120 V DC) and Low Voltage (LV) equipment, including PCs, phones, tablets, microcontroller boards, and embedded systems. We are not licensed electrical contractors and we do not perform, advise on, or accept any responsibility for mains-voltage (240 V AC) wiring or appliance work. Nothing on this Site, in our tutorials, forum, or in our repair or technical services constitutes advice, instruction, or authorisation for any mains-voltage electrical work.**

**Mains Voltage Hazard:** Mains-voltage electricity (240 V AC in Australia) can cause electrocution, cardiac arrest, severe burns, and death. All work on mains-connected equipment or infrastructure must only be performed by a licensed electrician under applicable state or territory legislation. Even after disconnection from mains supply, capacitors within mains-powered devices may retain lethal stored charge for extended periods. If your project involves mains voltage at any point, engage a licensed electrician - do not rely on this Site.

**Nothing in this section limits your rights under the Australian Consumer Law where a product we have supplied is defective.**

### Lithium Battery Hazard Warning

**⚠ WARNING - FIRE AND EXPLOSION RISK: Lithium-ion and lithium-polymer batteries can ignite and explode violently if punctured, short-circuited, overcharged, over-discharged, crushed, or exposed to excessive heat or physical damage. A lithium battery fire produces intense heat and toxic fumes, is extremely difficult to extinguish, and can result in complete destruction of property.**

You must handle, charge, store, transport, and dispose of lithium batteries strictly in accordance with manufacturer specifications and applicable dangerous-goods regulations. If a lithium battery shows signs of swelling (puffing), leaking, excessive heat generation, unusual odour, or discolouration, cease use immediately, move it away from flammable materials, and consult a qualified professional. Never charge a visibly damaged battery. Always use manufacturer-approved or compatible chargers within specified voltage and current limits.

**Nothing in this warning limits your rights under the Australian Consumer Law where a product sold by us is defective.**

### Product Compatibility and Electrical Ratings Disclaimer

We make no independent representation, warranty, or guarantee regarding the electrical ratings (voltage, current, power, temperature), compatibility, regulatory compliance, or fitness for purpose of any component or product for your specific application, installation environment, or load conditions. Component specifications published on this Site are sourced from manufacturers and distributors and may contain errors or may not reflect the most current revision of a product. You are solely responsible for verifying that any component or product is correctly rated and appropriate for your intended application before use. We are not liable for any loss, equipment damage, fire, personal injury, or death arising from the use of a component or product in an application for which it is incorrectly rated or unsuitable, to the fullest extent permitted by applicable law.

### Repair Services Disclaimer

Where we perform repair services on your device, our repair addresses the specific fault presented and agreed. A repaired device may contain other pre-existing or latent faults unrelated to the repair performed; we do not conduct a whole-device safety audit unless this is specifically agreed in writing. A device returned from repair is not certified safe for use in any safety-critical application beyond normal consumer use of that repaired item. If you intend to deploy a repaired device in a safety-critical environment, you should have it independently assessed by a qualified professional before doing so. To the fullest extent permitted by applicable law, we are not liable for any loss, damage, fire, personal injury, or adverse outcome arising from pre-existing conditions or latent faults in a repaired device, or from use of the device inconsistently with any instructions provided at time of return.

### External Links Disclaimer

The Site may contain links to other websites or content belonging to or originating from third parties. Such external links are not investigated, monitored, or checked for accuracy, adequacy, validity, reliability, availability, or completeness by us.

**WE DO NOT WARRANT, ENDORSE, GUARANTEE, OR ASSUME RESPONSIBILITY FOR THE ACCURACY OR RELIABILITY OF ANY INFORMATION OFFERED BY THIRD-PARTY WEBSITES. WE WILL NOT BE A PARTY TO OR IN ANY WAY RESPONSIBLE FOR ANY TRANSACTION BETWEEN YOU AND THIRD-PARTY PROVIDERS. ACCESS TO ANY LINKED WEBSITE IS AT YOUR OWN RISK.**

### Testimonials Disclaimer

Testimonials on the Site reflect the real-life experiences and opinions of individual users. They are personal to those users and may not be representative of all users of our products and services. We do not claim that all users will have the same experiences.

**YOUR INDIVIDUAL RESULTS MAY VARY. TESTIMONIALS ARE NOT GUARANTEES OF SPECIFIC RESULTS.**

Testimonials are reviewed by us before posting and appear substantially as given, except for minor corrections. The views in testimonials belong solely to the individual and do not represent our views. We are not affiliated with testimonial authors, and no compensation is provided for testimonials.

### Forum and User-Generated Content Disclaimer

Content posted on the Outback Electronics forum and community areas is generated by users and does not represent our views or recommendations. We do not warrant the accuracy, completeness, or usefulness of any user-generated content. You use forum content entirely at your own risk. We are not liable for any harm arising from your reliance on user-generated content.

### Availability Disclaimer

We do not warrant that the Site will be available at all times, uninterrupted, or free from errors. We reserve the right to withdraw or amend the Site at any time without notice. We are not liable for any consequences arising from the unavailability of the Site.

### No Professional Advice

Nothing on this Site constitutes legal, financial, accounting, tax, medical, safety, or other professional advice. You should seek independent professional advice tailored to your specific circumstances before acting on any information on this Site.

---`;

const BODY_ACCEPTABLE_USE = `_LEGAL · ACCEPTABLE USE POLICY_

## Acceptable Use Policy

This Acceptable Use Policy ('Policy') is part of our Terms and Conditions ('Legal Terms') and should be read alongside our main Legal Terms at [outbackelectronics.com.au/policies/terms-and-conditions](/policies/terms-and-conditions). If you do not agree with these Legal Terms, please refrain from using our Services. Your continued use of our Services implies acceptance of these Legal Terms.

This Policy applies to any and all: (a) uses of our Services; (b) forms, materials, consent tools, comments, posts, and all other content available on the Services ('Content'); and (c) material you contribute to the Services including uploads, posts, reviews, ratings, comments, chat, etc. ('Contribution').

### Who We Are

We are Outback Electronics ('Company', 'we', 'us', or 'our'), a mobile electronics services provider registered in Australia. Our ABN is {{abn}}. Our correspondence address is {{address}}, Australia. We operate the website [outbackelectronics.com.au](https://outbackelectronics.com.au) (the 'Site'), as well as any other related products and services that refer or link to this Policy (collectively, the 'Services').

### Use of the Services

When you use the Services, you warrant that you will comply with this Policy and with all applicable laws. You also acknowledge that you may not:

- Systematically retrieve data or other content from the Services to create or compile a collection, compilation, database, or directory without written permission from us.
- Make any unauthorised use of the Services, including collecting email addresses of users for sending unsolicited email, or creating user accounts by automated means or under false pretences.
- Circumvent, disable, or otherwise interfere with security-related features of the Services.
- Engage in unauthorised framing of or linking to the Services.
- Trick, defraud, or mislead us and other users, especially in any attempt to learn sensitive account information such as user passwords.
- Make improper use of our support services or submit false reports of abuse or misconduct.
- Engage in any automated use of the Services, such as using scripts to send comments or messages, or using data mining, robots, or similar data gathering and extraction tools.
- Interfere with, disrupt, or create an undue burden on the Services or the networks connected to the Services.
- Attempt to impersonate another user or person or use the username of another user.
- Use any information obtained from the Services in order to harass, abuse, or harm another person.
- Use the Services as part of any effort to compete with us or for any revenue-generating endeavour or commercial enterprise.
- Decipher, decompile, disassemble, or reverse engineer any of the software comprising or in any way making up a part of the Services, except as expressly permitted by applicable law.
- Attempt to bypass any measures of the Services designed to prevent or restrict access to the Services, or any portion of the Services.
- Harass, annoy, intimidate, or threaten any of our employees or agents.
- Delete the copyright or other proprietary rights notice from any Content.
- Copy or adapt the Services' software, including but not limited to HTML, JavaScript, or other code.
- Upload or transmit viruses, Trojan horses, spyware, or other material that interferes with any party's uninterrupted use and enjoyment of the Services.
- Use any automated system, including spiders, robots, scrapers, or offline readers, that accesses the Services without authorisation.
- Disparage, tarnish, or otherwise harm, in our opinion, us and/or the Services.
- Use the Services in a manner inconsistent with any applicable laws or regulations.
- Use a buying agent or purchasing agent to make purchases on the Services.
- Sell or otherwise transfer your or any other user's profile.

**Subscriptions.** If you subscribe to our Services, you may not: engage in any use, modification, copying, redistribution, or retransmission of any portions of the Services without prior written consent; reconstruct or attempt to discover any source code or algorithms; provide the Services to any third party; intercept data not intended for you; or damage, reveal, or alter any user's data or information relating to another person or entity.

### Community / Forum Guidelines

Please review our forum rules at [forum.outbackelectronics.com.au/t/forum-rules/7](https://forum.outbackelectronics.com.au/t/forum-rules/7).

### Contributions

A 'Contribution' means any data, information, software, text, code, music, scripts, sound, graphics, photos, videos, tags, messages, interactive features, or other materials you post, share, upload, submit, or otherwise provide on or through the Services.

We may but are under no obligation to review or moderate Contributions, and we expressly exclude our liability for any loss or damage resulting from any user's breach of this Policy. Please report any Contribution that you believe breaches this Policy.

You warrant that: you are the creator and owner of, or have the necessary licences and permissions to use your Contributions; all your Contributions comply with applicable laws and are original and true; your Contributions do not infringe the intellectual property rights of any third party; and you have verifiable consent from any identifiable individual person in your Contributions.

You also agree that you will not post any Contribution that is: in breach of applicable laws or court orders; defamatory, obscene, offensive, hateful, bullying, or threatening; false, inaccurate, or misleading; sexually explicit or harmful to minors; promoting violence or terrorism; discriminatory based on race, sex, religion, nationality, disability, sexual orientation, or age; or unsolicited advertising, spam, or pyramid schemes.

**Dangerous Technical Content:** You must not post any Contribution that: (a) provides instructions for electrical or electronic work that you know or ought reasonably to know is likely to cause injury, death, fire, or property damage if followed; (b) misrepresents the safety ratings, electrical specifications, or compliance status of any component or product; (c) encourages others to perform mains-voltage (240 V AC) electrical work without appropriate qualifications; (d) provides instructions for modifying lithium batteries, battery management systems, or chargers in a manner that creates a fire or explosion risk; or (e) omits material safety warnings that a reasonable person would expect to accompany such technical instructions. Any technical guide, tutorial, or post that involves inherent risk must include a prominent and accurate safety warning. We reserve the right to remove any Contribution that we consider poses a safety risk, without notice.

You may not use our Services to offer or promote: items that encourage illegal activity; cigarettes, nicotine, alcohol, or controlled substances; regulated weapons, firearms, or ammunition; sexually oriented materials; stolen goods; products or services that do not comply with applicable Australian product safety standards; mains-voltage (240 V AC) circuits or equipment (we list ELV/LV products only); or any transaction requiring pre-approval that has not been obtained.

**Third-Party Sellers:** If you list products for sale on our platform, all customer claims, warranty obligations, and ACL liability for those products rest with you as the seller. You must not represent Outback Electronics as providing any warranty, guarantee, or endorsement for your products. Any product-related dispute from a customer will be referred to you as the seller. Outback Electronics' liability as a platform operator does not extend to the quality, safety, or fitness for purpose of products listed by third-party sellers.

**Swap & Sell Classifieds:** Our Swap & Sell classifieds feature lets members post free listings to buy, sell, swap, or give away items directly with other members. We are not a party to, and have no liability for, any transaction arising from a Swap & Sell listing, including non-payment, non-delivery, item condition, item authenticity, or any dispute between the parties to the transaction. You deal with other members at your own risk and are responsible for satisfying yourself as to the legitimacy of the other party and the item before exchanging money or goods. By posting or responding to a Swap & Sell listing, you warrant that: you lawfully own the item, or are authorised to sell or give it away, and it is not stolen, counterfeit, or encumbered; the item is not a regulated, prohibited, or restricted good under the categories listed above (including weapons, mains-voltage equipment, or anything requiring a licence you do not hold); and your listing is accurate and not misleading. We may remove any Swap & Sell listing, and may report a listing or user to police or another relevant authority, without notice, where we reasonably suspect stolen goods, fraud, or another unlawful transaction.

### Reviews and Ratings

When your Contribution is a review or rating, you also agree that: you have firsthand experience with the goods or services being reviewed; your Contribution is true to your experience; you are not affiliated with competitors if posting negative reviews; you will not make false or misleading statements; and you will not organise a campaign encouraging others to post reviews.

### Reporting a Breach of This Policy

If you consider that any Service, Content, or Contribution breaches this Policy, please visit [forum.outbackelectronics.com.au](https://forum.outbackelectronics.com.au) or contact us using the details below. For suspected intellectual property infringement, please review our [Terms and Conditions](/policies/terms-and-conditions).

We will reasonably determine whether a Service, Content, or Contribution breaches this Policy and respond within a reasonable time.

Australian users may also report harmful online content (including cyberbullying and image-based abuse) to the eSafety Commissioner at [www.esafety.gov.au](https://www.esafety.gov.au) under the _Online Safety Act 2021_ (Cth).

### Consequences of Breaching This Policy

The consequences for violating our Policy will vary depending on the severity of the breach and the user's history on the Services. We may issue a warning and/or remove the infringing Contribution. For serious or repeated breaches, we have the right to suspend or terminate your access and, if applicable, disable your account. We may also notify law enforcement or issue legal proceedings when we believe there is a genuine risk to an individual or a threat to public safety.

We exclude our liability for all action we may take in response to your breach of this Policy.

### Complaints and Removal of Legitimate Content

If you consider that Content or a Contribution has been mistakenly removed or blocked, please contact us using the details below and we will promptly review our decision. The Content or Contribution may stay 'down' whilst we conduct the review. For more information, visit our [forum rules](https://forum.outbackelectronics.com.au/t/forum-rules/7).

### Disclaimer

Outback Electronics is under no obligation to monitor users' activities, and we disclaim any responsibility for any user's misuse of the Services. Outback Electronics has no responsibility for any user or other Content or Contribution created, maintained, stored, transmitted, or accessible on or through the Services, and is not obligated to monitor or exercise any editorial control over such material. If Outback Electronics becomes aware that any such Content or Contribution violates this Policy, Outback Electronics may, in addition to removing such Content or Contribution and blocking your account, report such breach to the police or appropriate regulatory authority.

**Technical Content Assumption of Risk:** Any technical information, repair guides, tutorials, or similar content posted by other users on this platform has not been verified by us and may be incomplete, inaccurate, or unsuitable for your specific device, application, or skill level. You assume all risk associated with acting on any user-generated technical content. We are not liable for any loss, damage, personal injury, death, fire, or property damage arising from your reliance on user-generated technical content. Always verify technical information from authoritative sources and consult a qualified professional before undertaking any electrical or electronic work.

### Contact Us

If you have any further questions or comments, or wish to report any problematic Content or Contribution, please contact us:

Email: [{{email}}](mailto:{{email}})
Online contact form: [outbackelectronics.com.au/contact](/contact)

---

**Questions?** Email [{{email}}](mailto:{{email}}) or use the [contact form](/contact).`;

const BODY_GENERAL_ENGAGEMENT = `_LEGAL · GENERAL TERMS OF ENGAGEMENT_

## General Terms of Engagement

This document applies to **every** person or business that interacts with Outback Electronics ('Company', 'we', 'us', or 'our') in any capacity - private customer, commercial customer, seller, or otherwise. Our ABN is {{abn}}.

### Commencement Is Acceptance

By doing any of the following, you accept and agree to be bound by all of our policies that apply to that activity (for example, our Terms and Conditions, Privacy Policy, Return Policy, Acceptable Use Policy, and - where relevant, our Custom Work and Reverse Engineering Policy, Seller Agreement, or Commercial Terms and Conditions):

- placing an order, paying a deposit, or paying for goods or services;
- submitting a repair, quote, or custom work request, or handing over a device or materials to us;
- creating an account on our Site, forum, customer portal, or seller dashboard;
- listing a product for sale on our platform as a seller;
- otherwise using our Site, services, or facilities.

You do not need to separately sign or click-accept each individual policy for it to apply, commencing the relevant activity is itself your acceptance, in the same way that walking into a shop and placing an order implies acceptance of that shop's standard terms of trade. Where we ask you to expressly sign or click-accept a specific document (for example, a quote, a non-disclosure agreement, or a seller agreement), that document applies in addition to, and to the extent of any inconsistency prevails over, this general statement.

### Which Policies Apply to You

Use the audience selector on this page to view the specific documents that apply to your relationship with us (private customer, commercial customer, or seller). Some documents - such as our Privacy Policy, Cookie Policy, and Acceptable Use Policy - apply to everyone regardless of audience. Others, such as our Commercial Terms and Conditions or Seller Agreement, apply only where that relationship exists.

### Updates to Our Policies

We may update any of our policies from time to time. Continuing to engage with us after an update takes effect constitutes acceptance of the updated policy. Material changes will be dated on the relevant document.

### Contact Us

**Outback Electronics**

- {{address}}, Australia
- Phone: [{{phone}}](tel:{{phoneHref}})
- Email: [{{email}}](mailto:{{email}})

---

**Questions?** Email [{{email}}](mailto:{{email}}), we'll get back to you as soon as we can.`;

const BODY_GIFT_CARDS = `_LEGAL · GIFT CARDS, STORE CREDIT & REWARDS_

## Gift Cards, Store Credit & Rewards Terms

This policy governs gift cards, store credit, and rewards points issued by Outback Electronics ('Company', 'we', 'us', or 'our'). Our ABN is {{abn}}. It applies alongside our Terms and Conditions and Return Policy.

### 1. Gift Cards

**Validity and Expiry.** Gift cards are valid for at least three (3) years from the date of issue, in accordance with the minimum expiry period required by the Australian Consumer Law. We will state the specific expiry date on the gift card or its accompanying record at the time of issue.

**Not Redeemable for Cash.** Gift cards cannot be redeemed or exchanged for cash, in whole or in part, except where required by law. They can only be applied against the purchase of goods or services from us.

**Lost or Stolen Cards.** We treat a gift card code as equivalent to cash. We are not responsible for, and will not replace or refund, a gift card that is lost, stolen, or used without your authorisation, except where required by law or where we are reasonably satisfied of fraud on our part.

**Partial Use and Balance.** If a purchase is less than your gift card balance, the remaining balance stays on the card for future use until it expires. You can check your balance using the balance lookup on our Site or by contacting us.

**No Resale.** Gift cards may not be resold or on-sold for a profit. We may void a gift card we reasonably believe was obtained fraudulently (for example, through a disputed or charged-back payment) and are not liable for any resulting loss to a subsequent holder who is not the original purchaser.

### 2. Store Credit

Store credit may be issued by us at our discretion (for example, as part of a refund, a trade-in, or a goodwill gesture) or where you have elected to receive store credit instead of a cash refund where both are offered. Store credit:

- is not redeemable for cash and can only be applied against future purchases from us;
- does not expire unless we tell you otherwise at the time it is issued;
- is not transferable to another person or account except with our written consent; and
- may be reversed or adjusted by us where it was issued in error, or where the transaction it relates to is reversed, refunded, or subject to a successful chargeback by the original payment method.

Where store credit was issued as an incentive (for example, a trade-in bonus for accepting credit instead of cash), that bonus amount may be removed if the underlying transaction is later unwound, for example, because the traded-in item was misdescribed, found to be faulty contrary to your description, or found not to be lawfully yours to sell.

### 3. Rewards Points

Rewards points are issued at our discretion as a loyalty benefit and have no cash value. Points may be redeemed for a discount on a future purchase in accordance with the redemption rate displayed in your account at the time of redemption, which we may change going forward without affecting points already earned.

**Clawback on Refund or Chargeback.** If an order that earned rewards points is later refunded, cancelled, or successfully charged back, we may deduct the points earned on that order from your account, even if you have since redeemed them - in which case your account balance may go negative and must be repaid through future earned points, or we may instead invoice you for the value of the discount obtained using those points, at our discretion.

**Fraud and Abuse.** We may suspend, adjust, or cancel rewards points, and may close the associated account, where we reasonably suspect the points were earned through fraud, abuse of the program (including the use of multiple accounts), or a breach of these terms.

Rewards points have no value if your account is closed for breach of our Terms and Conditions or Acceptable Use Policy, and do not survive the death of the account holder except as required by law.

### 4. Contact Us

**Outback Electronics**

- {{address}}, Australia
- Phone: [{{phone}}](tel:{{phoneHref}})
- Email: [{{email}}](mailto:{{email}})

---

**Questions?** Email [{{email}}](mailto:{{email}}), we'll get back to you as soon as we can.`;

const BODY_SALE_OF_GOODS = `_LEGAL · SALE OF GOODS TO US_

## Sale of Goods to Us - Trade-In, E-Waste & Consignment

This policy applies whenever you sell, trade in, consign, or otherwise provide used or end-of-life electronics or equipment to Outback Electronics ('Company', 'we', 'us', or 'our') - whether through our outright purchase, consignment, trade credit, or e-waste take-back programs ('Sale Programs'). Our ABN is {{abn}}. It applies alongside our Terms and Conditions.

### 1. Your Warranties of Title

By offering an item to us under any Sale Program, you warrant that:

- you are the lawful owner of the item, or have the owner's express authority to sell, consign, or dispose of it on their behalf;
- the item is not stolen, subject to any security interest, lease, finance arrangement, or third-party claim, and is free of any encumbrance;
- you have removed or disclosed any personal data, account locks (e.g. Find My, BIOS/firmware passwords, cloud activation locks), or other access restrictions that would prevent us from inspecting, testing, refurbishing, or reselling the item; and
- your description of the item's condition, fault history, and included accessories is accurate and complete to the best of your knowledge.

You indemnify us against any claim, loss, or liability arising from a breach of these warranties, including any claim by a third party asserting an interest in the item.

### 2. Verification and Right to Decline or Report

We may ask you for photo ID and proof of ownership (such as a receipt, warranty card, or account login demonstrating control of the device) before accepting an item, particularly for higher-value items or where the circumstances of the offer raise concern. We may decline to accept any item without giving a reason. Where we reasonably suspect an item offered to us is stolen or otherwise unlawfully obtained, we may refuse the transaction, retain the item, and report the matter - including your personal information and any identification you have provided, to police or another relevant authority, without further notice to you.

### 3. Grading and Pricing

Items are graded (e.g. A/B/C/D) and priced based on our assessment of condition, function, and current resale value at the time of inspection, which may differ from any estimate given before physical inspection. We will confirm the final grade and price with you before completing an outright purchase or trade credit transaction. For consignment, the listing price and commission are agreed separately and set out in our Seller Agreement or consignment terms provided to you at the time.

If, after inspection, an item does not match its description (for example, a fault was not disclosed, or an accessory listed as included is missing), we may revise our offer, decline the item, or - where the transaction has already completed, reverse the payment or store credit issued, including any associated bonus (see our Gift Cards, Store Credit & Rewards Terms).

### 4. Outright Purchase

Where we purchase an item outright, ownership transfers to us on payment, and the transaction is final - there is no cooling-off period or right to reverse the sale on your part, except as required by law (for example, where you were misled or the transaction was procured by fraud).

### 5. Consignment

Under consignment, you remain the owner of the item until it sells. We list and sell the item on your behalf for an agreed commission, and remit the net proceeds to you in accordance with the timeframe agreed at the time of listing. If the item does not sell within the agreed listing period, we will offer to return it to you, dispose of it, or relist it at a reduced price, as agreed. We are not liable for loss or damage to a consigned item beyond what is required by law, but will take reasonable care of it while in our possession.

### 6. Trade Credit

Where you elect to receive store credit instead of cash for a trade-in, any bonus applied to the store credit amount is subject to clause 3 (Grading and Pricing) above and our Gift Cards, Store Credit & Rewards Terms, including reversal if the underlying transaction is later found to be based on an inaccurate description or an item you were not entitled to sell.

### 7. E-Waste / No-Value Items

Items accepted for recycling or disposal with no resale value are accepted on the basis that you are surrendering ownership to us at no charge, for responsible recycling or disposal. The warranties in clause 1 still apply.

### 8. Contact Us

**Outback Electronics**

- {{address}}, Australia
- Phone: [{{phone}}](tel:{{phoneHref}})
- Email: [{{email}}](mailto:{{email}})

---

**Questions?** Email [{{email}}](mailto:{{email}}), we'll get back to you as soon as we can.`;

// Maps every audience+slug combination the public site's "viewing as" selector
// offers (POLICY_AUDIENCE_LABELS/POLICY_AUDIENCE_ORDER in pages-info.jsx) to its
// default body. Several slugs
// (privacy-policy, cookie-policy, disclaimer, acceptable-use, custom-work,
// gift-cards-store-credit-rewards, sale-of-goods-to-us) share identical text
// across audiences and so share the same BODY_* constant.
const POLICY_DEFAULTS = [
  // all
  { audience: 'all', slug: 'terms-of-engagement', title: 'General Terms of Engagement', updatedAt: '2026-06-19T00:00:00.000Z', body: BODY_GENERAL_ENGAGEMENT },
  { audience: 'all', slug: 'privacy-policy', title: 'Privacy Policy', updatedAt: '2026-06-06T00:00:00.000Z', body: BODY_PRIVACY },
  { audience: 'all', slug: 'cookie-policy', title: 'Cookie Policy', updatedAt: '2026-06-06T00:00:00.000Z', body: BODY_COOKIE },
  { audience: 'all', slug: 'acceptable-use', title: 'Acceptable Use Policy', updatedAt: '2026-06-06T00:00:00.000Z', body: BODY_ACCEPTABLE_USE },
  { audience: 'all', slug: 'disclaimer', title: 'Disclaimer', updatedAt: '2026-06-06T00:00:00.000Z', body: BODY_DISCLAIMER },
  { audience: 'all', slug: 'gift-cards-store-credit-rewards', title: 'Gift Cards, Store Credit & Rewards Terms', updatedAt: '2026-06-19T00:00:00.000Z', body: BODY_GIFT_CARDS },
  { audience: 'all', slug: 'sale-of-goods-to-us', title: 'Sale of Goods to Us', updatedAt: '2026-06-19T00:00:00.000Z', body: BODY_SALE_OF_GOODS },

  // private
  { audience: 'private', slug: 'terms-and-conditions', title: 'Terms & Conditions', updatedAt: '2026-06-06T00:00:00.000Z', body: BODY_TERMS_PRIVATE },
  { audience: 'private', slug: 'privacy-policy', title: 'Privacy Policy', updatedAt: '2026-06-06T00:00:00.000Z', body: BODY_PRIVACY },
  { audience: 'private', slug: 'shipping-and-delivery', title: 'Shipping & Delivery', updatedAt: '2026-08-18T00:00:00.000Z', body: BODY_SHIPPING },
  { audience: 'private', slug: 'cookie-policy', title: 'Cookie Policy', updatedAt: '2026-06-06T00:00:00.000Z', body: BODY_COOKIE },
  { audience: 'private', slug: 'return-policy', title: 'Return Policy', updatedAt: '2026-06-06T00:00:00.000Z', body: BODY_RETURN_PRIVATE },
  { audience: 'private', slug: 'custom-work', title: 'Custom Work & Reverse Engineering', updatedAt: '2026-06-19T00:00:00.000Z', body: BODY_CUSTOM_WORK },
  { audience: 'private', slug: 'disclaimer', title: 'Disclaimer', updatedAt: '2026-06-06T00:00:00.000Z', body: BODY_DISCLAIMER },
  { audience: 'private', slug: 'acceptable-use', title: 'Acceptable Use Policy', updatedAt: '2026-06-06T00:00:00.000Z', body: BODY_ACCEPTABLE_USE },
  { audience: 'private', slug: 'gift-cards-store-credit-rewards', title: 'Gift Cards, Store Credit & Rewards Terms', updatedAt: '2026-06-19T00:00:00.000Z', body: BODY_GIFT_CARDS },
  { audience: 'private', slug: 'sale-of-goods-to-us', title: 'Sale of Goods to Us', updatedAt: '2026-06-19T00:00:00.000Z', body: BODY_SALE_OF_GOODS },

  // commercial
  { audience: 'commercial', slug: 'terms-and-conditions', title: 'Terms & Conditions', updatedAt: '2026-06-06T00:00:00.000Z', body: BODY_TERMS_COMMERCIAL },
  { audience: 'commercial', slug: 'return-policy', title: 'Return Policy', updatedAt: '2026-06-06T00:00:00.000Z', body: BODY_RETURN_COMMERCIAL },
  { audience: 'commercial', slug: 'custom-work', title: 'Custom Work & Reverse Engineering', updatedAt: '2026-06-19T00:00:00.000Z', body: BODY_CUSTOM_WORK },
  { audience: 'commercial', slug: 'privacy-policy', title: 'Privacy Policy', updatedAt: '2026-06-06T00:00:00.000Z', body: BODY_PRIVACY },
  { audience: 'commercial', slug: 'shipping-and-delivery', title: 'Shipping & Delivery', updatedAt: '2026-08-18T00:00:00.000Z', body: BODY_SHIPPING },
  { audience: 'commercial', slug: 'cookie-policy', title: 'Cookie Policy', updatedAt: '2026-06-06T00:00:00.000Z', body: BODY_COOKIE },
  { audience: 'commercial', slug: 'disclaimer', title: 'Disclaimer', updatedAt: '2026-06-06T00:00:00.000Z', body: BODY_DISCLAIMER },
  { audience: 'commercial', slug: 'acceptable-use', title: 'Acceptable Use Policy', updatedAt: '2026-06-06T00:00:00.000Z', body: BODY_ACCEPTABLE_USE },
  { audience: 'commercial', slug: 'gift-cards-store-credit-rewards', title: 'Gift Cards, Store Credit & Rewards Terms', updatedAt: '2026-06-19T00:00:00.000Z', body: BODY_GIFT_CARDS },
  { audience: 'commercial', slug: 'sale-of-goods-to-us', title: 'Sale of Goods to Us', updatedAt: '2026-06-19T00:00:00.000Z', body: BODY_SALE_OF_GOODS },

  // seller
  { audience: 'seller', slug: 'terms-and-conditions', title: 'OHD001 – Terms and Conditions for Sellers', updatedAt: '2026-06-06T00:00:00.000Z', body: BODY_SELLER_TERMS },
  { audience: 'seller', slug: 'quality-standards', title: 'OHD002 – Design Quality Standards', updatedAt: '2026-06-06T00:00:00.000Z', body: BODY_SELLER_QUALITY },
  { audience: 'seller', slug: 'fees-schedule', title: 'OHD003 – Fees Schedule', updatedAt: '2026-06-06T00:00:00.000Z', body: BODY_SELLER_FEES },
  { audience: 'seller', slug: 'listing-requirements', title: 'OHD004 – Listing Requirements', updatedAt: '2026-06-06T00:00:00.000Z', body: BODY_SELLER_LISTING },
];

module.exports = POLICY_DEFAULTS;

# Ativa Dash – Google Ads API – Design & Use

> **Para o formulário Google:** Copie o conteúdo abaixo (a partir do título "Product overview") para um documento Word, formate se quiser e exporte como **PDF** para anexar no campo "Design documentation of your tool".

---

**Document version:** 1.0  
**Date:** March 2025  
**Company:** Ativadash  
**Product URL:** https://ativadash.com  
**API contact:** lojaprimecamp@gmail.com

---

## 1. Product overview

**Ativa Dash** is a SaaS dashboard for digital marketing agencies and product launchers (mainly in Brazil). The product is available at **https://app.ativadash.com**. Users sign in with email/password and can connect their own Google Ads account via OAuth2 to view campaign performance metrics in a single dashboard. We do not manage Google Ads campaigns on behalf of clients; we only provide a read-only reporting and visualization tool.

---

## 2. Intended use of the Google Ads API

We use the Google Ads API **in read-only mode**. We do not create, edit, or delete campaigns, ads, keywords, or any other advertising entities. Our use is limited to:

1. **Authentication:** Letting the user connect their Google Ads account with their consent (OAuth2).
2. **Reading metrics:** Fetching campaign-level data (impressions, clicks, cost, conversions) to display in our dashboard.
3. **Token refresh:** Using the refresh token to obtain new access tokens and keep the integration active.

No write operations are performed. No campaign or account settings are modified through the API.

---

## 3. User flow (high level)

1. User logs in to Ativa Dash at https://app.ativadash.com.
2. User goes to **Marketing → Integrações** (Integrations).
3. User clicks **“Conectar”** (Connect) for Google Ads.
4. User is redirected to Google’s OAuth consent screen (we request only the scope needed for reading Google Ads data).
5. After the user approves, Google redirects back to our backend callback URL:  
   `https://api.ativadash.com/api/integrations/google-ads/callback`
6. Our backend exchanges the authorization code for access and refresh tokens and stores them securely (encrypted in our database), associated with the user’s organization.
7. When the user opens **Marketing → Visão geral** (Overview), our backend calls the Google Ads API (using the stored tokens and our developer token) to fetch campaign and metrics data.
8. The dashboard displays the data (e.g. impressions, clicks, cost, conversions) in tables and summaries. We do not send any data back to Google except for read requests.

---

## 4. API scope and resources used

We use the Google Ads API only to **read** the following:

- **Campaigns:** List of campaigns and their names.
- **Metrics (campaign level):** Impressions, clicks, cost (in micros), conversions.

We use the standard Google Ads API reporting resources (e.g. `campaign`, metrics in the query) with a query that selects only the fields needed for our reports. We do not use:

- App Conversion Tracking API  
- Remarketing API  
- Any API that creates or modifies entities (campaigns, ad groups, ads, keywords, etc.)

Our integration is read-only reporting for dashboard visualization.

---

## 5. Technical summary

- **Backend:** Node.js (Express), Prisma (PostgreSQL). Hosted on our own infrastructure (VPS).
- **OAuth2:** We use the official OAuth2 flow; redirect URI is registered in Google Cloud Console and matches the callback used in production.
- **Token storage:** Access and refresh tokens are stored per organization in our database (integration record). Tokens are used only to call the Google Ads API from our server; they are never exposed to the front end except indirectly through the data we display.
- **Developer token:** Used only in server-side requests to the Google Ads API, never in client-side code or public repositories.

---

## 6. Compliance and data usage

- We request only the minimum scope necessary for reading Google Ads metrics.
- We do not share user Google Ads data with third parties; data is used only to display reports inside the user’s Ativa Dash account.
- We comply with Google Ads API terms and policies and do not perform any operations that would violate them (no bulk edits, no automated campaign changes, read-only access).

---

*This document describes the design and use of the Google Ads API within the Ativa Dash product. We are happy to provide any further detail required by the API review team.*

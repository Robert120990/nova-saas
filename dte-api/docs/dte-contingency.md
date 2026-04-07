# DTE Contingency (Contingencia)

The contingency module manages scenarios when Hacienda services are unavailable or when there are connectivity issues (broadband failure, power outage, etc.).

## 1. Triggering Contingency
Contingency can be triggered:
- **Automatically**: The `transmissionQueue` detects connectivity errors (ECONNREFUSED, ETIMEDOUT, 503) and moves the DTE to the contingency queue with status `CONTINGENCIA_PENDIENTE`.
- **Manualmente**: Via `POST /api/dte/contingency/start`.

## 2. Endpoint: `POST /api/dte/contingency/start`
Starts a contingency period. Standard DTE generation should continue as normal, but the transmission will be deferred.

## 3. Workflow for deferred DTE
Documents issued during contingency must be:
1. Generated with `tipoModelo: 2` and `tipoOperacion: 2`.
2. Signed normally.
3. Printed (PDF) with the contingency notice if required.
4. Stored in `dte_contingency_documents`.

## 4. Recovery: `POST /api/dte/contingency/stop/:id`
Closing the contingency period allows the background worker to start retransmitting queued documents.

## 5. Background Worker: `resendContingencyDTE.js`
- Runs every 5 minutes (configurable).
- Scans for `PENDING` documents in the contingency queue.
- Re-transmits to Hacienda using the standard reception endpoint.
- Updates status to `RETRANSMITIDO` upon acceptance.

## Dashboard / Status: `GET /api/dte/contingency/status`
Returns current statistics (pending vs. sent) and the history of contingency periods.

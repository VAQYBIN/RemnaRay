limit_req_zone $binary_remote_addr zone=rr_general:10m rate=20r/s;
limit_req_zone $binary_remote_addr zone=rr_api:10m     rate=10r/s;
limit_req_zone $binary_remote_addr zone=rr_auth:10m    rate=5r/m;
# Owner decision F17 (2026-09-26), a deviation from section 21.3: the 5r/m
# sign-in allowance counts the sign-in and TOTP POSTs only (section 9.1 limits
# `POST /auth/*`). A request with an empty key is not limited by this zone, so
# the console reading its own session (`GET .../auth/me`, on every page) falls
# to `rr_admin`, which is sized for a console page's calls.
map $request_method $rr_signin_key {
    POST    $binary_remote_addr;
    default "";
}
limit_req_zone $rr_signin_key      zone=rr_signin:10m  rate=5r/m;
limit_req_zone $binary_remote_addr zone=rr_admin:10m   rate=120r/m;
limit_req_zone $binary_remote_addr zone=rr_webhooks:10m rate=30r/s;
limit_req_status 429;
limit_conn_zone $binary_remote_addr zone=rr_conn:10m;

limit_req_zone $binary_remote_addr zone=rr_general:10m rate=20r/s;
limit_req_zone $binary_remote_addr zone=rr_api:10m     rate=10r/s;
limit_req_zone $binary_remote_addr zone=rr_auth:10m    rate=5r/m;
limit_req_zone $binary_remote_addr zone=rr_admin:10m   rate=30r/m;
limit_req_zone $binary_remote_addr zone=rr_webhooks:10m rate=30r/s;
limit_req_status 429;
limit_conn_zone $binary_remote_addr zone=rr_conn:10m;

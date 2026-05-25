SKIP = {".git", "node_modules", "vendor", "dist", "build", "__pycache__"}

PATTERNS = {
    "route": ["route(", "@app.", "router.", "get(", "post(", "controller", "location "],
    "sql": ["select ", "insert ", "update ", "delete ", "raw(", "execute(", "query("],
    "command": ["subprocess", "exec(", "system(", "spawn(", "shell_exec", "shell=true"],
    "file": ["open(", "readfile", "writefile", "send_file", "download", "file_get_contents"],
    "upload": ["upload", "multipart", "filename", "content-type", "attachment"],
    "ssrf": ["requests.", "fetch(", "http.get", "httpclient", "curl", "proxy_pass"],
    "secret": ["secret", "token", "password", "api_key", ".env", "credential"],
    "parser": ["xml", "yaml.load", "deserialize", "pickle", "template", "unserialize", "erb"],
    "state": ["csrf", "state", "approve", "reset", "callback", "redirect"],
    "headers": ["access-control-allow-origin", "x-frame-options", "frame-ancestors", "content-security-policy", "samesite"],
    "host": ["http_host", "x-forwarded", "forwarded-host", "host header", "wwwroot"],
    "identity": ["oauth", "oidc", "saml", "shibboleth", "ldap", "sso", "mfa"],
    "object": ["userid", "courseid", "groupid", "contextid", "tenant", "itemid", "instanceid"],
    "xss": ["innerhtml", "ng-bind-html", "html_writer", "format_text", "format_string", "param_raw", "param_notags"],
}

DETAILS = {
    "routes": ["@app.", "route(", "get(", "post(", "case '", "location ", "proxy_pass"],
    "inputs": ["$_get", "$_post", "$_files", "optional_param", "required_param", "param_raw", "param_notags", "php://input", "request.", "params[", "location.hash", "localstorage", "json.parse", "http_host", "x-forwarded", "scope", "state", "userid", "courseid", "groupid", "contextid", "itemid", "instanceid"],
    "sinks": ["query(", "execute(", "get_records_sql", "get_record_sql", "sql_like", "insert_record", "update_record", "delete_records", "shell_exec", "system(", "exec(", "eval(", "erb", "unserialize", "simplexml", "ldap_search", "xpath", "curl_init", "curl->get", "curl->post", "file_get_contents", "readfile", "writefile", "send_file", "download", "header(", "redirect(", "innerhtml", "ng-bind-html", "html_writer", "format_text", "format_string", "mustache", "move_uploaded_file"],
    "exposures": ["alias ", "root ", "password", "secret", "admin", "example", "debug", "default", "uploads", "access-control-allow-origin", "x-frame-options", "frame-ancestors", "content-security-policy", "composer.lock", "package-lock", "npm-shrinkwrap"],
}

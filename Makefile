# Aliases for `./scripts/rr`, which reads the profile out of `.env` so nobody
# has to remember which containers a proxy profile needs.
.PHONY: build up down logs ps config tls-issue proxy-reload backup restore help

RR := ./scripts/rr

build:         ; @$(RR) build $(filter-out $@,$(MAKECMDGOALS))
up:            ; @$(RR) up
down:          ; @$(RR) down
logs:          ; @$(RR) logs $(filter-out $@,$(MAKECMDGOALS))
ps:            ; @$(RR) ps
config:        ; @$(RR) config
tls-issue:     ; @$(RR) tls:issue
proxy-reload:  ; @$(RR) proxy:reload
backup:        ; @$(RR) backup
restore:       ; @$(RR) restore $(filter-out $@,$(MAKECMDGOALS))

help:
	@$(RR) help

%:
	@:

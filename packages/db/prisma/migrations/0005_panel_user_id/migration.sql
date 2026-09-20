-- Remnawave v3.4.4 identifies users by numeric id. `panel_uuid` remains the
-- user's VLESS UUID for the subscription snapshot and admin API compatibility.
ALTER TABLE panel_users ADD COLUMN panel_user_id integer;

CREATE UNIQUE INDEX ux_panel_users_panel_user_id
  ON panel_users (panel_id, panel_user_id);

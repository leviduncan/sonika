-- Free-text "About this client" brief captured on the Add Client form. Fed to
-- Claude at provision time (alongside the scraped website) so the agent reflects
-- what the agency knows about the client — services, hours, call-handling
-- preferences — even when the website is thin, blocked, or missing. Nullable:
-- the brief is optional and provisioning still works without it.
alter table sub_accounts add column brief text;

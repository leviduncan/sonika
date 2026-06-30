-- Store the Vapi phone-number resource id on the seat so it can be cleaned up
-- (deleted in Vapi) when a client is removed or re-provisioned. Without it we
-- can release the Twilio number and delete the assistant, but the Vapi
-- phone-number resource would be orphaned.
alter table seats add column vapi_phone_number_id text;

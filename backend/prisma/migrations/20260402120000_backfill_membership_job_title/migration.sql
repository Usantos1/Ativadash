-- Membros sem cargo definido: viewer → cliente; demais → gestor de tráfego (padrão operacional).
UPDATE "Membership"
SET "jobTitle" = 'client_viewer'
WHERE "jobTitle" IS NULL AND "role" = 'report_viewer';

UPDATE "Membership"
SET "jobTitle" = 'traffic_manager'
WHERE "jobTitle" IS NULL;

UPDATE "Invitation"
SET "jobTitle" = CASE WHEN "role" = 'report_viewer' THEN 'client_viewer' ELSE 'traffic_manager' END
WHERE "jobTitle" IS NULL AND "acceptedAt" IS NULL;

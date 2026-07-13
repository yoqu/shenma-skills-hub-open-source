-- Allow newly submitted skills to use the same explicit review status as reviews.
ALTER TABLE skills
  MODIFY status ENUM('DRAFT','PENDING','PENDING_REVIEW','APPROVED','REJECTED','UNLISTED')
  NOT NULL DEFAULT 'DRAFT';

UPDATE skills
SET status = 'PENDING_REVIEW'
WHERE status = 'PENDING';

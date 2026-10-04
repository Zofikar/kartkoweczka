UPDATE `questions`
SET `type` = 'choice'
WHERE `type` = 'true_false';
--> statement-breakpoint
UPDATE `test_revisions`
SET `content` = replace(`content`, '"type":"true_false"', '"type":"choice"')
WHERE `content` LIKE '%"type":"true_false"%';
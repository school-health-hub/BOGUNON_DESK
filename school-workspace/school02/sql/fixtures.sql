-- Synthetic institutions only; no NEIS or actual school data imported.
INSERT INTO workspace.schools(id,office_code,school_code,name,state) VALUES('10000000-0000-0000-0000-000000000004','B10','0000004','합성 새학교','unclaimed');
UPDATE workspace.schools SET office_code=CASE WHEN id='10000000-0000-0000-0000-000000000001' THEN 'B10' ELSE 'C10' END,school_code='0000001',name='합성 늘봄학교' WHERE id IN('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002');
INSERT INTO workspace.s02_directory VALUES
('10000000-0000-0000-0000-000000000001','B10','0000001','합성 늘봄학교','서울특별시교육청','초등학교'),
('10000000-0000-0000-0000-000000000002','C10','0000001','합성 늘봄학교','부산광역시교육청','중학교'),
('10000000-0000-0000-0000-000000000004','B10','0000004','합성 새학교','서울특별시교육청','고등학교');
-- Fresh unjoined synthetic identities; existing membership fixtures stay unchanged.
INSERT INTO auth.users SELECT ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid FROM generate_series(11,20)i;
INSERT INTO auth.sessions(id,user_id) SELECT ('30000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid FROM generate_series(11,20)i;

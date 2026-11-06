-- LOCAL SYNTHETIC ONLY. Do not include in operating installation order.
DO $$BEGIN IF current_database()<>'school01a' THEN RAISE EXCEPTION 'isolated_fixture_required';END IF;END$$;
CREATE ROLE supabase_auth_admin NOLOGIN NOBYPASSRLS;
ALTER SCHEMA auth OWNER TO supabase_auth_admin;
ALTER TABLE auth.users OWNER TO supabase_auth_admin;
ALTER TABLE auth.sessions OWNER TO supabase_auth_admin;
ALTER FUNCTION auth.uid()OWNER TO supabase_auth_admin;
ALTER FUNCTION auth.jwt()OWNER TO supabase_auth_admin;
-- Extra column proves the reader is not granted table-wide or excessive SELECT.
ALTER TABLE auth.sessions ADD COLUMN test_private_metadata text;
CREATE ROLE s06_simulated_default_client NOLOGIN;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT EXECUTE ON FUNCTIONS TO s06_simulated_default_client;
CREATE ROLE school_rest LOGIN NOINHERIT NOBYPASSRLS;
GRANT anon,authenticated TO school_rest;
DO $fixture$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['tasks','events','profiles','medication_items']LOOP
 EXECUTE format('CREATE TABLE public.%I(id uuid PRIMARY KEY,user_id uuid NOT NULL,label text NOT NULL)',t);
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY original_user_only ON public.%I TO authenticated USING(user_id=auth.uid())WITH CHECK(user_id=auth.uid())',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE ON public.%I TO authenticated',t);
 EXECUTE format('INSERT INTO public.%I VALUES(gen_random_uuid(),%L,%L),(gen_random_uuid(),%L,%L)',t,'00000000-0000-0000-0000-000000000001','synthetic original row A','00000000-0000-0000-0000-000000000002','synthetic original row B');
 END LOOP;END $fixture$;
-- Name/ACL sentinels, NOT audited copies of actual hosted function bodies.
DO $legacy$ DECLARE n text;BEGIN FOREACH n IN ARRAY ARRAY['complete_workflow_instance','create_workflow_instance_bundle','delete_project_budget','delete_project_expense','delete_project_reservation','delete_project_reservation_with_expense','owns_project','receive_medication','reorder_project_checklist_items','reorder_project_places','save_project_budget','save_project_expense','save_project_reservation','save_project_reservation_with_expense','save_workflow_template_bundle','transition_workflow_instance','transition_workflow_step','update_project_expense_status','update_workflow_step_bundle','assign_project_checklist_sort_order']LOOP
 EXECUTE format('CREATE FUNCTION public.%I()RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='''' AS %L',n,'SELECT false');
 EXECUTE format('REVOKE ALL ON FUNCTION public.%I()FROM PUBLIC,anon',n);
 IF n<>'assign_project_checklist_sort_order'THEN EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I()TO authenticated',n);ELSE EXECUTE format('REVOKE ALL ON FUNCTION public.%I()FROM authenticated',n);END IF;
 END LOOP;END $legacy$;

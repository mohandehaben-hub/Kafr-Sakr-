-- ==============================================================================
-- سكربت إصلاح وترقية حسابات المشرفين في منظومة تقنين كفر صقر
-- ==============================================================================
-- تم تطبيقه بنجاح ومباشرة على قاعدة بيانات Supabase
-- ==============================================================================

-- 1. إصلاح الحقول التي كانت NULL في auth.users
UPDATE auth.users
SET 
    instance_id = '00000000-0000-0000-0000-000000000000'::uuid,
    aud = 'authenticated',
    role = 'authenticated',
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change = COALESCE(email_change, ''),
    email_change_token_new = COALESCE(email_change_token_new, '')
WHERE confirmation_token IS NULL 
   OR recovery_token IS NULL 
   OR email_change IS NULL 
   OR email_change_token_new IS NULL;

-- 2. التأكد من وجود سجلات في auth.identities
INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
SELECT 
    gen_random_uuid(), u.id,
    jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
    'email', u.id::text, now(), now(), now()
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
);

-- 3. ترقية دالة إنشاء المشرفين
CREATE OR REPLACE FUNCTION public.create_supervisor_account(
    p_username text,
    p_password text,
    p_full_name text DEFAULT ''::text,
    p_role text DEFAULT 'VIEWER'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
    v_clean_username text;
    v_email text;
    v_user_id uuid;
    v_encrypted_pw text;
    v_role staff_role;
BEGIN
    IF NOT public.is_super() THEN
        RAISE EXCEPTION 'غير مصرح: هذه العملية خاصة بالمدير العام فقط.';
    END IF;

    v_clean_username := lower(trim(p_username));
    IF v_clean_username = '' OR length(v_clean_username) < 3 THEN
        RAISE EXCEPTION 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل.';
    END IF;

    IF trim(p_password) = '' OR length(trim(p_password)) < 6 THEN
        RAISE EXCEPTION 'كلمة المرور يجب أن تكون 6 خانات على الأقل.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.staff WHERE lower(username) = v_clean_username) THEN
        RAISE EXCEPTION 'اسم المستخدم موجود بالفعل، يرجى اختيار اسم آخر.';
    END IF;

    v_email := v_clean_username || '@gmail.com';

    IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
        RAISE EXCEPTION 'البريد أو اسم المستخدم مسجل مسبقاً.';
    END IF;

    BEGIN
        v_role := upper(trim(p_role))::staff_role;
    EXCEPTION WHEN OTHERS THEN
        v_role := 'VIEWER'::staff_role;
    END;

    v_user_id := gen_random_uuid();
    v_encrypted_pw := extensions.crypt(trim(p_password), extensions.gen_salt('bf', 10));

    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new
    ) VALUES (
        v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
        v_email, v_encrypted_pw, now(),
        jsonb_build_object('username', v_clean_username, 'full_name', p_full_name, 'email_verified', true),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        now(), now(),
        '', '', '', ''
    );

    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
        'email', v_user_id::text, now(), now(), now()
    );

    INSERT INTO public.staff (
        user_id, username, full_name, role, is_active, created_at, created_by
    ) VALUES (
        v_user_id, v_clean_username, coalesce(nullif(trim(p_full_name), ''), v_clean_username),
        v_role, true, now(), auth.uid()
    );

    RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'username', v_clean_username, 'role', v_role);
END;
$function$;

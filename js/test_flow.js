const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function runTests() {
  console.log('🚀 Starting Automated Logic & Database Constraints Test Flow...\n');

  const testId = Date.now().toString().slice(-4);
  const validNationalId = `2950101130${testId}`; // Valid Egypt National ID (14 digits)
  const validPhone = '01012345678';
  const testName = `مواطن تجريبي ${testId}`;
  const testChassis = `CHASSIS-${testId}`;
  const testMotor = `MOTOR-${testId}`;

  let passedTestsCount = 0;
  let totalTestsCount = 5;

  // Track created test ids to delete during cleanup
  let createdOrderId = null;
  let createdComplaintId = null;

  // --- TEST 1: Valid Order Creation ---
  try {
    console.log('👉 [Test 1] Creating valid TukTuk order...');
    const { data, error } = await supabase
      .from('orders')
      .insert([{
        owner_name: testName,
        national_id: validNationalId,
        phone: validPhone,
        vehicle_type: 'توكتوك',
        vehicle_year: '2020',
        address: 'كفر صقر، الشرقية',
        chassis_number: testChassis,
        motor_number: testMotor,
        ref_number: `KS-${testId}`,
        submitted_at: Date.now(),
        status: 'pending'
      }])
      .select();

    if (error) {
      console.error('❌ Test 1 Failed: Cannot create valid order:', error.message);
    } else if (data && data.length > 0) {
      createdOrderId = data[0].id;
      console.log('✅ Test 1 Passed: Valid order created successfully. ID:', createdOrderId);
      passedTestsCount++;
    } else {
      console.error('❌ Test 1 Failed: No data returned.');
    }
  } catch (err) {
    console.error('❌ Test 1 Exception:', err.message);
  }

  // --- TEST 2: Invalid Order Prevention (National ID Format Check) ---
  try {
    console.log('\n👉 [Test 2] Testing database constraint for invalid National ID...');
    const { data, error } = await supabase
      .from('orders')
      .insert([{
        owner_name: `${testName} (Invalid)`,
        national_id: '1234567890123', // 13 digits only (Invalid)
        phone: validPhone,
        vehicle_type: 'توكتوك',
        vehicle_year: '2020',
        address: 'كفر صقر',
        chassis_number: `CHASSIS-INVALID-${testId}`,
        motor_number: `MOTOR-INVALID-${testId}`,
        ref_number: `KS-INV-${testId}`,
        submitted_at: Date.now(),
        status: 'pending'
      }]);

    if (error && error.code === '23514') {
      console.log('✅ Test 2 Passed: Invalid national_id insertion was BLOCKED by DB constraint.');
      passedTestsCount++;
    } else if (error) {
      console.error('❌ Test 2 Failed: Blocked but unexpected error code:', error.code, error.message);
    } else {
      console.error('❌ Test 2 Failed: Database allowed inserting an invalid National ID!');
      // Clean it up if it was inserted
      if (data && data.length > 0) {
        await supabase.from('orders').delete().eq('id', data[0].id);
      }
    }
  } catch (err) {
    console.error('❌ Test 2 Exception:', err.message);
  }

  // --- TEST 3: Duplicates Prevention ---
  try {
    console.log('\n👉 [Test 3] Testing duplicate National ID prevention...');
    const { data, error } = await supabase
      .from('orders')
      .insert([{
        owner_name: `${testName} (Duplicate)`,
        national_id: validNationalId, // Same valid National ID as Test 1
        phone: '01512345678',
        vehicle_type: 'توكتوك',
        vehicle_year: '2021',
        address: 'كفر صقر',
        chassis_number: `CHASSIS-DUP-${testId}`,
        motor_number: `MOTOR-DUP-${testId}`,
        ref_number: `KS-DUP-${testId}`,
        submitted_at: Date.now(),
        status: 'pending'
      }]);

    if (error && (error.code === '23505' || error.code === 'P0001')) {
      console.log(`✅ Test 3 Passed: Duplicate national_id insertion was BLOCKED by unique/custom constraint (Code: ${error.code}).`);
      passedTestsCount++;
    } else if (error) {
      console.error('❌ Test 3 Failed: Blocked but unexpected error code:', error.code, error.message);
    } else {
      console.error('❌ Test 3 Failed: Database allowed inserting a duplicate National ID!');
      if (data && data.length > 0) {
        await supabase.from('orders').delete().eq('id', data[0].id);
      }
    }
  } catch (err) {
    console.error('❌ Test 3 Exception:', err.message);
  }

  // --- TEST 4: Inquiry RPC check ---
  try {
    console.log('\n👉 [Test 4] Querying created order using "get_my_order" RPC...');
    const { data, error } = await supabase.rpc('get_my_order', {
      p_national_id: validNationalId,
      p_owner_name: testName,
      p_phone: validPhone
    });

    if (error) {
      console.error('❌ Test 4 Failed: RPC error:', error.message);
    } else if (data && data.length > 0 && data[0].id === createdOrderId) {
      console.log('✅ Test 4 Passed: RPC retrieved the correct test order.');
      passedTestsCount++;
    } else {
      console.error('❌ Test 4 Failed: RPC did not return the expected test order. Data:', data);
    }
  } catch (err) {
    console.error('❌ Test 4 Exception:', err.message);
  }

  // --- TEST 5: Complaints and Complaint Inquiry RPC ---
  try {
    console.log('\n👉 [Test 5] Submitting and querying complaint...');
    const { data: compData, error: compError } = await supabase
      .from('complaints')
      .insert([{
        owner_name: testName,
        national_id: validNationalId,
        phone: validPhone,
        complaint_type: 'تأخير تكويد',
        details: 'تفاصيل الشكوى التجريبية الخاصة بالاختبار',
        images: ['test_selfie.jpg', 'test_id.jpg'],
        submitted_at: Date.now(),
        status: 'pending'
      }])
      .select();

    if (compError) {
      console.error('❌ Test 5 Failed: Cannot insert complaint:', compError.message);
    } else if (compData && compData.length > 0) {
      createdComplaintId = compData[0].id;
      
      // Query it back using RPC
      const { data: queryData, error: queryError } = await supabase.rpc('get_my_complaints', {
        p_national_id: validNationalId,
        p_owner_name: testName,
        p_phone: validPhone
      });

      if (queryError) {
        console.error('❌ Test 5 Failed: Cannot query complaints RPC:', queryError.message);
      } else if (queryData && queryData.length > 0 && queryData[0].id === createdComplaintId) {
        console.log('✅ Test 5 Passed: Complaint submitted and queried via RPC successfully.');
        passedTestsCount++;
      } else {
        console.error('❌ Test 5 Failed: Complaints RPC did not return the test complaint. Data:', queryData);
      }
    }
  } catch (err) {
    console.error('❌ Test 5 Exception:', err.message);
  }

  // --- CLEANUP ---
  console.log('\n🧹 Cleaning up test database records...');
  if (createdOrderId) {
    const { error } = await supabase.from('orders').delete().eq('id', createdOrderId);
    if (error) console.error('Failed to clean up test order:', error.message);
  }
  if (createdComplaintId) {
    const { error } = await supabase.from('complaints').delete().eq('id', createdComplaintId);
    if (error) console.error('Failed to clean up test complaint:', error.message);
  }
  console.log('✅ Cleanup completed.');

  // --- REPORT ---
  console.log('\n======================================');
  console.log(`📊 Test Results: ${passedTestsCount}/${totalTestsCount} Tests Passed.`);
  console.log('======================================');
  
  if (passedTestsCount === totalTestsCount) {
    console.log('🎉 System is fully functional, secure, and ready!');
  } else {
    console.error('❌ Some tests failed. Please review the errors above.');
    process.exit(1);
  }
}

runTests();

import request from 'supertest';
import { createApp } from '../../src/app';
import { config } from '../../src/config';
import { prisma } from '../../src/lib/prisma';

const app = createApp();

describe('BP5 integration', () => {
  let accessToken = '';

  beforeAll(async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: config.seed.adminEmail,
      password: config.seed.adminPassword,
    });
    expect(res.status).toBe(200);
    accessToken = res.body.data.accessToken as string;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function auth() {
    return { Authorization: `Bearer ${accessToken}` };
  }

  async function createDoctor(namePrefix: string) {
    const res = await request(app)
      .post('/api/v1/doctors')
      .set(auth())
      .send({
        name: `${namePrefix} ${Date.now()}-${Math.random()}`,
        title: 'Consultant',
        phone: `010${Date.now().toString().slice(-8)}`,
        speciality: 'Cardiology',
        address: 'Cairo',
        hospital: 'Test Hospital',
      });
    expect(res.status).toBe(201);
    return res.body.data as { id: number; name: string };
  }

  async function createPatient(namePrefix: string) {
    const res = await request(app)
      .post('/api/v1/patients')
      .set(auth())
      .send({
        name: `${namePrefix} ${Date.now()}-${Math.random()}`,
        phone: `011${Date.now().toString().slice(-8)}`,
        address: 'Giza',
        gender: 'male',
        age: 40,
      });
    expect(res.status).toBe(201);
    return res.body.data as { id: number; name: string };
  }

  async function createLabTest(namePrefix: string) {
    const res = await request(app)
      .post('/api/v1/lab-tests')
      .set(auth())
      .send({ name: `${namePrefix} ${Date.now()}-${Math.random()}`, center: 'Central Lab' });
    expect(res.status).toBe(201);
    return res.body.data as { id: number; name: string };
  }

  describe('Doctors CRUD', () => {
    it('creates, lists, gets, updates, and deletes a doctor', async () => {
      const doctor = await createDoctor('CrudDoctor');

      const list = await request(app).get('/api/v1/doctors').set(auth());
      expect(list.status).toBe(200);
      expect(list.body.data.items.some((d: { id: number }) => d.id === doctor.id)).toBe(true);

      const get = await request(app).get(`/api/v1/doctors/${doctor.id}`).set(auth());
      expect(get.status).toBe(200);
      expect(get.body.data.id).toBe(doctor.id);
      // Global master data: no shop_id on the response.
      expect(get.body.data.shopId).toBeUndefined();

      const updated = await request(app)
        .patch(`/api/v1/doctors/${doctor.id}`)
        .set(auth())
        .send({ hospital: 'Updated Hospital' });
      expect(updated.status).toBe(200);
      expect(updated.body.data.hospital).toBe('Updated Hospital');

      const del = await request(app).delete(`/api/v1/doctors/${doctor.id}`).set(auth());
      expect(del.status).toBe(200);

      const afterDelete = await request(app).get(`/api/v1/doctors/${doctor.id}`).set(auth());
      expect(afterDelete.status).toBe(404);
    });

    it('rejects a duplicate doctor name with 409', async () => {
      const doctor = await createDoctor('DupDoctor');
      const res = await request(app).post('/api/v1/doctors').set(auth()).send({
        name: doctor.name,
        title: 'GP',
        phone: '01099999999',
        speciality: 'General',
      });
      expect(res.status).toBe(409);
    });
  });

  describe('Patients CRUD', () => {
    it('creates, lists, gets, updates, and deletes a patient', async () => {
      const patient = await createPatient('CrudPatient');

      const list = await request(app).get('/api/v1/patients').set(auth());
      expect(list.status).toBe(200);
      expect(list.body.data.items.some((p: { id: number }) => p.id === patient.id)).toBe(true);

      const get = await request(app).get(`/api/v1/patients/${patient.id}`).set(auth());
      expect(get.status).toBe(200);
      expect(get.body.data.shopId).toBeUndefined();

      const updated = await request(app)
        .patch(`/api/v1/patients/${patient.id}`)
        .set(auth())
        .send({ age: 41 });
      expect(updated.status).toBe(200);
      expect(updated.body.data.age).toBe(41);

      const del = await request(app).delete(`/api/v1/patients/${patient.id}`).set(auth());
      expect(del.status).toBe(200);

      const afterDelete = await request(app).get(`/api/v1/patients/${patient.id}`).set(auth());
      expect(afterDelete.status).toBe(404);
    });
  });

  describe('Lab tests CRUD', () => {
    it('creates, lists, gets, updates, and deletes a lab test', async () => {
      const test = await createLabTest('CrudTest');

      const list = await request(app).get('/api/v1/lab-tests').set(auth());
      expect(list.status).toBe(200);
      expect(list.body.data.items.some((t: { id: number }) => t.id === test.id)).toBe(true);

      const get = await request(app).get(`/api/v1/lab-tests/${test.id}`).set(auth());
      expect(get.status).toBe(200);
      expect(get.body.data.shopId).toBeUndefined();

      const updated = await request(app)
        .patch(`/api/v1/lab-tests/${test.id}`)
        .set(auth())
        .send({ center: 'Updated Lab' });
      expect(updated.status).toBe(200);
      expect(updated.body.data.center).toBe('Updated Lab');

      const del = await request(app).delete(`/api/v1/lab-tests/${test.id}`).set(auth());
      expect(del.status).toBe(200);

      const afterDelete = await request(app).get(`/api/v1/lab-tests/${test.id}`).set(auth());
      expect(afterDelete.status).toBe(404);
    });

    it('rejects a duplicate lab test name with 409', async () => {
      const test = await createLabTest('DupTest');
      const res = await request(app)
        .post('/api/v1/lab-tests')
        .set(auth())
        .send({ name: test.name });
      expect(res.status).toBe(409);
    });
  });

  describe('Prescriptions', () => {
    it('creates a prescription with a unique prescriptionNo and correctly-shaped medicines/tests JSON', async () => {
      const doctor = await createDoctor('RxDoctor');
      const patient = await createPatient('RxPatient');
      const labTest = await createLabTest('RxLabTest');

      const res = await request(app)
        .post('/api/v1/prescriptions')
        .set(auth())
        .send({
          patientId: patient.id,
          referredTo: doctor.id,
          visitNo: 1,
          visitFees: 100,
          description: 'Initial consultation',
          advice: 'Drink plenty of fluids',
          medicine: ['Paracetamol', 'Amoxicillin'],
          schedule: ['1-0-1', '1-1-1'],
          day: ['5', '7'],
          test: [labTest.name],
        });

      expect(res.status).toBe(201);
      const created = res.body.data;
      expect(created.prescriptionNo).toMatch(/^RX\d{10}$/);
      expect(created.medicines).toEqual([
        { medicine: 'Paracetamol', schedule: '1-0-1', day: '5' },
        { medicine: 'Amoxicillin', schedule: '1-1-1', day: '7' },
      ]);
      expect(created.tests).toEqual([{ test: labTest.name }]);
      expect(created.patient.id).toBe(patient.id);
      expect(created.doctor.id).toBe(doctor.id);
      expect(created.date).toBeDefined();

      return { created, doctor, patient };
    });

    it('generates distinct prescriptionNo values across concurrent creates (collision-safe)', async () => {
      const doctor = await createDoctor('ConcurrentDoctor');
      const patient = await createPatient('ConcurrentPatient');

      const send = () =>
        request(app)
          .post('/api/v1/prescriptions')
          .set(auth())
          .send({
            patientId: patient.id,
            referredTo: doctor.id,
            visitNo: 1,
            visitFees: 50,
            description: 'Concurrent test',
            advice: 'None',
            medicine: [],
            schedule: [],
            day: [],
            test: [],
          });

      const results = await Promise.all([send(), send(), send(), send(), send()]);
      results.forEach((r) => expect(r.status).toBe(201));
      const numbers = results.map((r) => r.body.data.prescriptionNo);
      expect(new Set(numbers).size).toBe(numbers.length);
    });

    it('rejects mismatched medicine/schedule/day array lengths with 400', async () => {
      const doctor = await createDoctor('MismatchDoctor');
      const patient = await createPatient('MismatchPatient');

      const res = await request(app)
        .post('/api/v1/prescriptions')
        .set(auth())
        .send({
          patientId: patient.id,
          referredTo: doctor.id,
          visitNo: 1,
          visitFees: 50,
          description: 'Mismatch test',
          advice: 'None',
          medicine: ['Paracetamol', 'Amoxicillin'],
          schedule: ['1-0-1'],
          day: ['5', '7'],
          test: [],
        });
      expect(res.status).toBe(400);
    });

    it('rejects a referredTo that does not exist as a doctor id with 400', async () => {
      const patient = await createPatient('BadDoctorPatient');
      const res = await request(app)
        .post('/api/v1/prescriptions')
        .set(auth())
        .send({
          patientId: patient.id,
          referredTo: 999999,
          visitNo: 1,
          visitFees: 50,
          description: 'Bad doctor test',
          advice: 'None',
          medicine: [],
          schedule: [],
          day: [],
          test: [],
        });
      expect(res.status).toBe(400);
    });

    it('full lifecycle: create -> patch (working fix) -> get round-trips all fields -> delete', async () => {
      const doctor = await createDoctor('LifecycleDoctor');
      const patient = await createPatient('LifecyclePatient');
      const doctor2 = await createDoctor('LifecycleDoctor2');
      const patient2 = await createPatient('LifecyclePatient2');
      const labTest = await createLabTest('LifecycleTest');

      const createRes = await request(app)
        .post('/api/v1/prescriptions')
        .set(auth())
        .send({
          patientId: patient.id,
          referredTo: doctor.id,
          visitNo: 1,
          visitFees: 75,
          description: 'Before update',
          advice: 'Before advice',
          medicine: ['Ibuprofen'],
          schedule: ['1-1-1'],
          day: ['3'],
          test: [],
        });
      expect(createRes.status).toBe(201);
      const prescriptionId = createRes.body.data.id;

      const patchRes = await request(app)
        .patch(`/api/v1/prescriptions/${prescriptionId}`)
        .set(auth())
        .send({
          patientId: patient2.id,
          referredTo: doctor2.id,
          visitNo: 2,
          visitFees: 200,
          description: 'After update',
          advice: 'After advice',
          medicine: ['Omeprazole', 'Cetirizine'],
          schedule: ['1-0-0', '0-0-1'],
          day: ['14', '10'],
          test: [labTest.name],
        });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.description).toBe('After update');

      const getRes = await request(app)
        .get(`/api/v1/prescriptions/${prescriptionId}`)
        .set(auth());
      expect(getRes.status).toBe(200);
      const fetched = getRes.body.data;
      expect(fetched.patientId).toBe(patient2.id);
      expect(fetched.doctorId).toBe(doctor2.id);
      expect(fetched.visitNo).toBe(2);
      expect(Number(fetched.visitFees)).toBeCloseTo(200, 2);
      expect(fetched.description).toBe('After update');
      expect(fetched.advice).toBe('After advice');
      expect(fetched.medicines).toEqual([
        { medicine: 'Omeprazole', schedule: '1-0-0', day: '14' },
        { medicine: 'Cetirizine', schedule: '0-0-1', day: '10' },
      ]);
      expect(fetched.tests).toEqual([{ test: labTest.name }]);
      expect(fetched.patient.id).toBe(patient2.id);
      expect(fetched.doctor.id).toBe(doctor2.id);

      const delRes = await request(app)
        .delete(`/api/v1/prescriptions/${prescriptionId}`)
        .set(auth());
      expect(delRes.status).toBe(200);

      const afterDelete = await request(app)
        .get(`/api/v1/prescriptions/${prescriptionId}`)
        .set(auth());
      expect(afterDelete.status).toBe(404);
    });

    it('rejects a PATCH with mismatched medicine/schedule/day array lengths with 400', async () => {
      const doctor = await createDoctor('PatchMismatchDoctor');
      const patient = await createPatient('PatchMismatchPatient');
      const createRes = await request(app)
        .post('/api/v1/prescriptions')
        .set(auth())
        .send({
          patientId: patient.id,
          referredTo: doctor.id,
          visitNo: 1,
          visitFees: 10,
          description: 'd',
          advice: 'a',
          medicine: [],
          schedule: [],
          day: [],
          test: [],
        });
      const prescriptionId = createRes.body.data.id;

      const patchRes = await request(app)
        .patch(`/api/v1/prescriptions/${prescriptionId}`)
        .set(auth())
        .send({ medicine: ['A', 'B'], schedule: ['1-1-1'], day: ['1', '2'] });
      expect(patchRes.status).toBe(400);
    });

    it('lists prescriptions', async () => {
      const res = await request(app).get('/api/v1/prescriptions').set(auth());
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.meta.total).toBeGreaterThan(0);
    });
  });
});

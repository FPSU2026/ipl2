import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Resident } from '../types';

const Residents: React.FC = () => {
  const { residents, addResident, updateResident, deleteResident, deleteAllResidents } = useApp();

  const [formData, setFormData] = useState<Partial<Resident>>({});
  const [editing, setEditing] = useState<Resident | null>(null);

  const handlePhoneChange = (value: string) => {
    const clean = value.replace(/\D/g, '');
    setFormData(prev => ({ ...prev, phone: clean }));
  };

  const handleNumberChange = (field: keyof Resident, value: string) => {
    const num = value === '' ? 0 : parseInt(value);
    setFormData(prev => ({ ...prev, [field]: num }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data: Resident = {
      id: editing?.id || crypto.randomUUID(),
      houseNo: formData.houseNo || '',
      name: formData.name || formData.houseNo || 'Warga Baru',
      rt: formData.rt || 'RT 01',
      rw: formData.rw || 'RW 01',
      phone: formData.phone || '',
      initialMeter: formData.initialMeter || 0,
      initialArrears: formData.initialArrears || 0,
      status: formData.status || 'PEMILIK',
      isDispensation: false,
      dispensationNote: '',
      exemptions: [],
      activeCustomFees: [],
    };

    if (editing) await updateResident(data);
    else await addResident(data);

    setFormData({});
    setEditing(null);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Data Warga</h2>

      <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
        <input
          placeholder="No Rumah"
          value={formData.houseNo || ''}
          onChange={e => setFormData({ ...formData, houseNo: e.target.value })}
          required
        />
        <input
          placeholder="Nama"
          value={formData.name || ''}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
        />
        <input
          placeholder="RT"
          value={formData.rt || ''}
          onChange={e => setFormData({ ...formData, rt: e.target.value })}
        />
        <input
          placeholder="RW"
          value={formData.rw || ''}
          onChange={e => setFormData({ ...formData, rw: e.target.value })}
        />
        <input
          placeholder="No WA"
          value={formData.phone || ''}
          onChange={e => handlePhoneChange(e.target.value)}
          required
        />
        <input
          placeholder="Meter Awal"
          type="number"
          value={formData.initialMeter || 0}
          onChange={e => handleNumberChange('initialMeter', e.target.value)}
        />

        <button type="submit">{editing ? 'Update' : 'Tambah'}</button>
      </form>

      <button onClick={deleteAllResidents}>Hapus Semua</button>

      <table border={1} cellPadding={6} style={{ marginTop: 20 }}>
        <thead>
          <tr>
            <th>Rumah</th>
            <th>Nama</th>
            <th>RT/RW</th>
            <th>WA</th>
            <th>Meter</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {residents.map(r => (
            <tr key={r.id}>
              <td>{r.houseNo}</td>
              <td>{r.name}</td>
              <td>{r.rt}/{r.rw}</td>
              <td>
                <a href={`https://wa.me/${r.phone.replace(/^0/, '62')}`} target="_blank" rel="noreferrer">
                  {r.phone}
                </a>
              </td>
              <td>{r.initialMeter}</td>
              <td>
                <button onClick={() => { setEditing(r); setFormData(r); }}>Edit</button>
                <button onClick={() => deleteResident(r.id)}>Hapus</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Residents;

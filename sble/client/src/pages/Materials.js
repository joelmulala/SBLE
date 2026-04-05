import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';

export default function Materials() {
  const { id: courseId } = useParams();
  const { keycloak } = useKeycloak();
  const isLecturer = keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin');

  const [materials, setMaterials] = useState([]);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.get(`/materials/course/${courseId}`).then(r => setMaterials(r.data));
  }, [courseId]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !title) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('title', title);
    form.append('course_id', courseId);
    try {
      const res = await api.post('/materials/upload', form);
      setMaterials(prev => [...prev, res.data]);
      setFile(null); setTitle('');
    } finally {
      setUploading(false);
    }
  };

  const downloadMaterial = async (materialId, fileName) => {
    try {
      const response = await api.get(`/materials/${materialId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || `material-${materialId}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (_) {
      alert('Download failed');
    }
  };

  return (
    <div>
      <h2>Learning Materials</h2>

      {isLecturer && (
        <form onSubmit={handleUpload} style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Material title" required
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', flex: 1 }} />
          <input type="file" accept=".pdf,.doc,.docx,.jpg,.png" onChange={e => setFile(e.target.files[0])} required />
          <button type="submit" disabled={uploading}
            style={{ background: '#4f8ef7', color: '#fff', padding: '8px 20px', borderRadius: 6, border: 'none', cursor: 'pointer' }}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </form>
      )}

      <ul style={{ marginTop: 24, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {materials.map(m => (
          <li key={m.id} style={{ background: '#fff', padding: 16, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{m.title} <small style={{ color: '#aaa' }}>({m.file_name})</small></span>
            <button onClick={() => downloadMaterial(m.id, m.file_name)}
              style={{ color: '#4f8ef7', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Download</button>
          </li>
        ))}
        {materials.length === 0 && <p style={{ color: '#888' }}>No materials uploaded yet.</p>}
      </ul>
    </div>
  );
}

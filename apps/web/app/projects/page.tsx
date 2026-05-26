'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

interface Project {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  async function reload() {
    const res = await apiFetch<{ projects: Project[] }>('/v1/projects');
    if (res.ok) setProjects(res.data.projects);
    else if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
  }

  useEffect(() => {
    (async () => {
      const me = await apiFetch<{ user?: unknown }>('/v1/auth/me');
      if (!me.ok) {
        window.location.href = '/login';
        return;
      }
      setAuthChecked(true);
      await reload();
    })();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const res = await apiFetch<{ project: Project }>('/v1/projects', {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    });
    setLoading(false);
    if (!res.ok) {
      setErr(res.error.message ?? `HTTP ${res.status}`);
      return;
    }
    setName('');
    setSlug('');
    await reload();
  }

  if (!authChecked) {
    return <p className="muted">Đang kiểm tra phiên đăng nhập…</p>;
  }

  return (
    <>
      <h1>Projects</h1>
      <form onSubmit={create} className="card">
        <h3>Tạo project mới</h3>
        <p className="muted">
          Một project gói tất cả domain + scan + finding của một tổ chức/ứng dụng đang được audit.
        </p>
        <div className="row">
          <input
            placeholder="Tên project (vd: ShopX)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            placeholder="slug (vd: shopx)"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            Tạo
          </button>
        </div>
        {err && <small style={{ color: 'var(--sev-critical)' }}>{err}</small>}
      </form>

      <div className="card">
        <h3>Danh sách project</h3>
        {projects.length === 0 && <p className="muted">Chưa có project nào.</p>}
        {projects.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Tên</th>
                <th>Slug</th>
                <th>Tạo lúc</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="muted">{p.slug}</td>
                  <td className="muted">{new Date(p.createdAt).toLocaleString()}</td>
                  <td>
                    <a href={`/projects/${p.id}`}>Mở</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

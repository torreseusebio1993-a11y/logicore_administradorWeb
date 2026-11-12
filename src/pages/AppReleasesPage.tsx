import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type { AppRelease } from '../api/types'
import { PageHeader } from '../components/Layout'
import { Badge, btn, ErrorBox, Field, formatDate, input, Spinner } from '../components/ui'

/** logicore-0.3.0+3.apk → ["0.3.0", 3] */
const fromName = (name: string): [string, number] | null => {
  const m = /(\d+\.\d+\.\d+)\+(\d+)\.apk$/i.exec(name)
  return m ? [m[1], Number(m[2])] : null
}

export default function AppReleasesPage () {
  const qc = useQueryClient()
  const releases = useQuery({ queryKey: ['app-releases'], queryFn: api.appReleases })
  const users = useQuery({ queryKey: ['monitor-metrics', 7], queryFn: () => api.monitorMetrics(7) })

  const [file, setFile] = useState<File | null>(null)
  const [version, setVersion] = useState('')
  const [code, setCode] = useState('')
  const [notes, setNotes] = useState('')
  const [mandatory, setMandatory] = useState(false)

  const refresh = () => qc.invalidateQueries({ queryKey: ['app-releases'] })
  const upload = useMutation({
    mutationFn: () => api.uploadAppRelease(file!, { version_name: version, version_code: Number(code), notes, mandatory }),
    onSuccess: () => { setFile(null); setVersion(''); setCode(''); setNotes(''); setMandatory(false); refresh() },
  })
  const edit = useMutation({
    mutationFn: ({ id, ...data }: { id: number, mandatory?: boolean, active?: boolean }) => api.updateAppRelease(id, data),
    onSuccess: refresh,
  })
  const remove = useMutation({ mutationFn: (id: number) => api.deleteAppRelease(id), onSuccess: refresh })

  const pick = (f: File | null) => {
    setFile(f)
    const v = f && fromName(f.name)
    if (v) { setVersion(v[0]); setCode(String(v[1])) }
  }
  const latest = releases.data?.find(r => r.active)

  return (
    <>
      <PageHeader title='App móvil' subtitle='Versiones publicadas: los teléfonos se actualizan solos al abrir la app' />
      <div className='grid gap-6 p-8 xl:grid-cols-[1fr_24rem]'>
        <div className='space-y-6'>
          <ErrorBox error={releases.error || edit.error || remove.error} />
          <section className='rounded-2xl border border-slate-200 bg-white p-5'>
            <h2 className='mb-3 font-semibold'>Versiones</h2>
            {releases.isLoading ? <Spinner /> : (
              <table className='w-full text-sm'>
                <thead className='text-left text-xs uppercase text-slate-500'>
                  <tr><th className='py-1'>Versión</th><th>Publicada</th><th>Tamaño</th><th>Descargas</th><th>Estado</th><th /></tr>
                </thead>
                <tbody className='divide-y divide-slate-100'>
                  {(releases.data ?? []).map((r: AppRelease) => (
                    <tr key={r.id} className='align-top'>
                      <td className='py-2'>
                        <div className='font-semibold'>{r.version_name} <span className='font-normal text-slate-500'>({r.version_code})</span></div>
                        {r.notes && <div className='max-w-md whitespace-pre-line text-xs text-slate-600'>{r.notes}</div>}
                      </td>
                      <td className='text-xs'>{formatDate(r.created_at, true)}</td>
                      <td>{(r.size_bytes / 1e6).toFixed(0)} MB</td>
                      <td>{r.downloads}</td>
                      <td className='space-x-1'>
                        {r.id === latest?.id && <Badge color='bg-green-100 text-green-800'>Actual</Badge>}
                        {r.mandatory && <Badge color='bg-red-100 text-red-700'>Obligatoria</Badge>}
                        {!r.active && <Badge color='bg-slate-100 text-slate-600'>Retirada</Badge>}
                      </td>
                      <td className='whitespace-nowrap text-right'>
                        <div className='flex justify-end gap-3'>
                          <button className={btn.link} onClick={() => edit.mutate({ id: r.id, mandatory: !r.mandatory })}>
                            {r.mandatory ? 'Quitar obligatoria' : 'Hacer obligatoria'}
                          </button>
                          <button className={btn.link} onClick={() => edit.mutate({ id: r.id, active: !r.active })}>
                            {r.active ? 'Retirar' : 'Reactivar'}
                          </button>
                          {!r.active && (
                            <button className='text-sm font-medium text-red-600 hover:underline'
                              onClick={() => confirm(`¿Borrar la versión ${r.version_name}? Se elimina el archivo.`) && remove.mutate(r.id)}>
                              Borrar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {releases.data?.length === 0 && <p className='py-4 text-center text-sm text-slate-500'>Todavía no hay versiones publicadas.</p>}
          </section>

          <section className='rounded-2xl border border-slate-200 bg-white p-5'>
            <h2 className='mb-3 font-semibold'>Qué versión tiene cada usuario</h2>
            {!users.data ? <Spinner /> : (
              <ul className='divide-y divide-slate-100 text-sm'>
                {users.data.users.map(u => {
                  const outdated = latest && u.app_version && u.app_version !== latest.version_name
                  return (
                    <li key={u.id} className='flex justify-between py-2'>
                      <span>{u.name}</span>
                      <span>
                        {u.app_version ?? <span className='text-slate-400'>sin datos de la app</span>}
                        {outdated && <span className='ml-2 text-amber-700'>⚠️ falta actualizar</span>}
                        {latest && u.app_version === latest.version_name && <span className='ml-2 text-green-700'>✅ al día</span>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>

        <section className='h-fit rounded-2xl border border-slate-200 bg-white p-5'>
          <h2 className='mb-1 font-semibold'>Publicar versión nueva</h2>
          <p className='mb-4 text-xs text-slate-500'>
            El APK debe estar firmado con la llave de producción de LogiCore; si no, Android no lo acepta como actualización.
          </p>
          <form className='space-y-3' onSubmit={e => { e.preventDefault(); upload.mutate() }}>
            <Field label='Archivo APK' hint='Ej. logicore-0.4.0+4.apk (la versión se toma del nombre)'>
              <input className={input} type='file' accept='.apk' required onChange={e => pick(e.target.files?.[0] ?? null)} />
            </Field>
            <div className='grid grid-cols-2 gap-3'>
              <Field label='Versión'><input className={input} placeholder='0.4.0' value={version} required onChange={e => setVersion(e.target.value)} /></Field>
              <Field label='Compilación'><input className={input} type='number' min={1} placeholder='4' value={code} required onChange={e => setCode(e.target.value)} /></Field>
            </div>
            <Field label='Qué hay de nuevo' hint='Lo verá el repartidor al actualizar'>
              <textarea className={input} rows={4} value={notes} onChange={e => setNotes(e.target.value)} />
            </Field>
            <label className='flex items-start gap-2 text-sm'>
              <input type='checkbox' className='mt-1' checked={mandatory} onChange={e => setMandatory(e.target.checked)} />
              <span><b>Obligatoria</b><span className='block text-xs text-slate-500'>Quien no actualice no podrá seguir usando la app.</span></span>
            </label>
            <ErrorBox error={upload.error} />
            <button className={btn.primary} disabled={upload.isPending || !file}>
              {upload.isPending ? 'Subiendo…' : 'Publicar'}
            </button>
          </form>
        </section>
      </div>
    </>
  )
}

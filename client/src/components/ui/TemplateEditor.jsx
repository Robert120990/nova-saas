import { useRef } from 'react';
import VariableBadge from './VariableBadge';

const TemplateEditor = ({ title, body, availableVariables, onTitleChange, onBodyChange }) => {
  const bodyRef = useRef(null);

  const insertVariable = (varName) => {
    if (bodyRef.current) {
      const start = bodyRef.current.selectionStart;
      const end = bodyRef.current.selectionEnd;
      const newBody = body.substring(0, start) + `{{${varName}}}` + body.substring(end);
      onBodyChange(newBody);
      setTimeout(() => {
        bodyRef.current.focus();
        const pos = start + varName.length + 4;
        bodyRef.current.setSelectionRange(pos, pos);
      }, 0);
    } else {
      onBodyChange((body || '') + `{{${varName}}}`);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
          Título de la notificación
        </label>
        <input
          value={title || ''}
          onChange={(e) => onTitleChange(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
          placeholder="Ej: Cierre {{turno}} - ${{total_ventas}}"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
          Cuerpo del mensaje
        </label>
        <textarea
          ref={bodyRef}
          value={body || ''}
          onChange={(e) => onBodyChange(e.target.value)}
          rows={5}
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all resize-y font-mono"
          placeholder="Ej: Total: ${{total_ventas}}\nGalones: {{total_galones}}"
        />
      </div>

      {availableVariables && availableVariables.length > 0 && (
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
            Variables disponibles
          </label>
          <div className="flex flex-wrap gap-1.5">
            {availableVariables.map((v) => (
              <VariableBadge key={v} name={v} onClick={insertVariable} />
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">
            Haz clic en una variable para insertarla en el cuerpo del mensaje
          </p>
        </div>
      )}

      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
          Vista previa
        </label>
        <div className="bg-white rounded-lg p-3 border border-slate-100">
          <p className="text-sm font-bold text-slate-800">
            {title || 'Título de la notificación'}
          </p>
          {body && (
            <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">
              {body}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateEditor;

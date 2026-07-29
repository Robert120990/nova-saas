import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen, ChevronRight, FileText, Loader2 } from 'lucide-react';

const Manual = () => {
  const [sections, setSections] = useState([]);
  const [activeSection, setActiveSection] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    axios.get('/api/manual')
      .then(res => {
        const items = (res.data.data || []).sort((a, b) => a.order - b.order);
        setSections(items);
        if (items.length > 0) loadSection(items[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const loadSection = async (id) => {
    setLoadingContent(true);
    setActiveSection(id);
    try {
      const res = await axios.get(`/api/manual/${id}`);
      setContent(res.data.data.content);
    } catch {
      setContent('# Error\nNo se pudo cargar esta sección.');
    }
    setLoadingContent(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] gap-0">
      <aside className="w-64 bg-white border-r border-slate-200 overflow-y-auto p-4 flex-shrink-0">
        <div className="flex items-center gap-2 mb-6 px-2">
          <BookOpen size={20} className="text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Manual de Usuario</h2>
        </div>
        <nav className="space-y-1">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => loadSection(s.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all text-left ${
                activeSection === s.id
                  ? 'bg-indigo-50 text-indigo-700 font-bold shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 font-medium'
              }`}
            >
              <ChevronRight size={14} className={activeSection === s.id ? 'text-indigo-500' : 'text-slate-300'} />
              <FileText size={14} />
              {s.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
        {loadingContent ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-indigo-600" size={32} />
          </div>
        ) : (
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-100 p-8 md:p-12 prose prose-slate max-w-none prose-headings:text-slate-900 prose-h1:text-2xl prose-h1:font-bold prose-h2:text-xl prose-h2:font-bold prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-slate-900 prose-pre:text-slate-100">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
      </main>
    </div>
  );
};

export default Manual;

// path: src/js/notesEngine.js
// context: javascript / notesEngine.js / browser-storage / target: mobile-android

export class NotesEngine {
  constructor(onNoteSavedCallback = null) {
    this.storageKey = 'saif_verse_notes_v1';
    this.notes = [];
    this.listeners = [];
    this.onNoteSaved = onNoteSavedCallback;
    this.load();
  }

  setOnNoteSaved(callback) {
    this.onNoteSaved = callback;
  }

  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        this.notes = JSON.parse(raw);
      } else {
        this.notes = [
          {
            id: 'starter-1',
            title: 'Welcome to SAIF-VERSE ✨',
            content: 'Your thoughts, daily reflections, and creative sparks living in fluid liquid glass.\n\n• Live dynamic themes shifting every day\n• Cherry blossom particles & interactive canvas\n• Instant community sync to Discord\n• Gallery photo upload & offline auto-queue\n\nTap the + button below to write your first note!',
            dayTag: 'Sunday',
            category: 'Journal',
            isPinned: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            color: 'from-pink-500/30 to-purple-500/20'
          }
        ];
        this.save(false);
      }
    } catch (e) {
      console.error('Error loading notes from local storage:', e);
      this.notes = [];
    }
  }

  save(triggerCallback = false, savedNote = null, isUpdate = false) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.notes));
      this.notify();
      if (triggerCallback && savedNote && this.onNoteSaved) {
        this.onNoteSaved(savedNote, isUpdate);
      }
    } catch (e) {
      console.error('Error saving notes to local storage:', e);
    }
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.notes);
  }

  notify() {
    this.listeners.forEach(cb => cb(this.notes));
  }

  getAllNotes() {
    return [...this.notes].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }

  createNote({ title, content, dayTag = 'General', category = 'Thoughts', color = 'from-white/10 to-white/5' }) {
    const newNote = {
      id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title: title.trim() || 'Untitled Reflection',
      content: content.trim(),
      dayTag,
      category,
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      color
    };

    this.notes.unshift(newNote);
    this.save(true, newNote, false);
    return newNote;
  }

  updateNote(id, { title, content, category, isPinned }) {
    const index = this.notes.findIndex(n => n.id === id);
    if (index === -1) return null;

    this.notes[index] = {
      ...this.notes[index],
      title: title !== undefined ? title.trim() : this.notes[index].title,
      content: content !== undefined ? content.trim() : this.notes[index].content,
      category: category !== undefined ? category : this.notes[index].category,
      isPinned: isPinned !== undefined ? isPinned : this.notes[index].isPinned,
      updatedAt: new Date().toISOString()
    };

    const updated = this.notes[index];
    this.save(true, updated, true);
    return updated;
  }

  togglePin(id) {
    const note = this.notes.find(n => n.id === id);
    if (note) {
      note.isPinned = !note.isPinned;
      note.updatedAt = new Date().toISOString();
      this.save(false);
    }
  }

  deleteNote(id) {
    this.notes = this.notes.filter(n => n.id !== id);
    this.save(false);
  }

  searchNotes(query) {
    if (!query || !query.trim()) return this.getAllNotes();
    const q = query.toLowerCase().trim();
    return this.getAllNotes().filter(note => 
      note.title.toLowerCase().includes(q) ||
      note.content.toLowerCase().includes(q) ||
      note.dayTag.toLowerCase().includes(q) ||
      note.category.toLowerCase().includes(q)
    );
  }
}

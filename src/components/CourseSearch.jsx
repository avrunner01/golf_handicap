import { useState } from 'react';

export default function CourseSearch({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    try {
      // Use local API route to avoid CORS issues and secure API key
      const response = await fetch(`/api/golf-search?q=${encodeURIComponent(query)}`, {
        credentials: 'include'
      });
      const data = await response.json();
      console.log(data);
      setResults(data.courses || []);
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="search-container">
      <div className="flex gap-2">
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search course name..."
          className="border p-2 rounded w-full text-black"
        />
        <button 
          onClick={handleSearch}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          {loading ? '...' : 'Search'}
        </button>
      </div>

      {results.length > 0 && (
        <ul className="mt-4 border rounded bg-white text-black max-h-60 overflow-y-auto">
          {results.map((course) => (
            <li 
              key={course.id} 
              className="p-3 border-b hover:bg-gray-100 cursor-pointer"
              onClick={() => onSelect && onSelect(course)}
            >
              <div className="font-bold">{course.club_name}</div>
              <div className="text-sm text-gray-600">{course.course_name}</div>
            </li>
          ))}
        </ul>
      )}

      {!loading && query && results.length === 0 && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded">
          Course not found. Enter manually, or try again.
        </div>
      )}
    </div>
  );
}


import { useState } from 'react';

export default function CourseSearch({ onSelect }) {
  const MIN_QUERY_LENGTH = 3;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSearch = async () => {
    const normalizedQuery = query.trim();

    if (normalizedQuery.length < MIN_QUERY_LENGTH) {
      setHasSearched(false);
      setResults([]);
      setErrorMessage('');
      return;
    }

    setHasSearched(true);
    setLoading(true);
    setErrorMessage('');
    try {
      // Use local API route to avoid CORS issues and secure API key
      const response = await fetch(`/api/golf-search?q=${encodeURIComponent(normalizedQuery)}`, {
        credentials: 'include'
      });

      const data = await response.json();
      if (!response.ok) {
        setResults([]);
        setErrorMessage(data.error || 'Search failed. Please try again.');
        return;
      }

      setResults(data.courses || []);
    } catch (err) {
      console.error("Search failed", err);
      setResults([]);
      setErrorMessage('Search failed. Please try again.');
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
          onChange={(e) => {
            const nextQuery = e.target.value;
            setQuery(nextQuery);

            if (nextQuery.trim().length < MIN_QUERY_LENGTH) {
              setHasSearched(false);
              setResults([]);
              setErrorMessage('');
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSearch();
            }
          }}
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

      {!!errorMessage && (
        <div className="mt-4 p-4 bg-red-50 border border-red-300 text-red-800 rounded">
          {errorMessage}
        </div>
      )}

      {!loading && !errorMessage && hasSearched && query.trim().length >= MIN_QUERY_LENGTH && results.length === 0 && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded">
          Course not found. Enter manually, or try again.
        </div>
      )}
    </div>
  );
}


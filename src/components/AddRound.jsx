import React, { useState } from "react";
import CourseSearch from "../components/CourseSearch";

const getSearchResultTees = (course) => {
  if (Array.isArray(course?.tees)) {
    return course.tees;
  }

  const maleTees = Array.isArray(course?.tees?.male) ? course.tees.male : [];
  const femaleTees = Array.isArray(course?.tees?.female) ? course.tees.female : [];

  return [...maleTees, ...femaleTees];
};

export default function AddRound({ courses: initialCourses }) {
  const [showModal, setShowModal] = useState(false);
  const [courses, setCourses] = useState(initialCourses || []);
  const [selectedTeeId, setSelectedTeeId] = useState("");
  const selectRef = React.useRef(null);

  // Refetch courses from API (client-side)
  const fetchCourses = async () => {
    const res = await fetch("/api/courses/list");
    const data = await res.json();
    const nextCourses = data.courses || [];
    setCourses(nextCourses);
    return nextCourses;
  };

  const handleAddCourseClick = (e) => {
    e.preventDefault();
    setShowModal(true);
  };

  const handleCourseSelect = async (course) => {
    setShowModal(false);
    const tees = getSearchResultTees(course)
      .map((tee) => ({
        tee_name: tee.tee_name || "",
        color_code: tee.tee_name || "",
        rating: tee.course_rating ?? tee.rating ?? "",
        slope: tee.slope_rating ?? tee.slope ?? "",
        par: tee.par_total ?? tee.par ?? "",
      }))
      .filter((tee) => tee.tee_name && tee.rating && tee.slope && tee.par);

    if (tees.length === 0) {
      window.alert("No tee data was returned for that course, so it could not be added.");
      return;
    }

    const payload = {
      course_name: course.course_name || course.club_name || course.name || "",
      location: course.location || null,
      tees,
    };

    const response = await fetch('/api/courses/create', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

    if (!response.ok) {
      const errorText = await response.text();
      window.alert(errorText || 'Failed to add course.');
      return;
    }

    const result = await response.json();
    const refreshedCourses = await fetchCourses();
    const updatedCourse = refreshedCourses.find((item) => item.id === result.courseId)
      || refreshedCourses.find((item) => item.name === payload.course_name);

    if (result.selectedTeeId) {
      setSelectedTeeId(String(result.selectedTeeId));
    } else if (updatedCourse && updatedCourse.tees.length > 0) {
      setSelectedTeeId(String(updatedCourse.tees[0].id));
    }

    setTimeout(() => {
      if (selectRef.current) selectRef.current.focus();
    }, 100);
  };

  return (
    <main className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Post New Round</h1>
      <form action="/api/rounds/create" method="POST" className="space-y-6 bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm mb-2">
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-semibold text-green-900">Select Course & Tee</label>
            <a href="#" onClick={handleAddCourseClick} className="text-xs text-green-700 hover:underline font-semibold">+ Add Course</a>
          </div>
          <select
            name="tee_id"
            required
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-600 focus:ring-green-600"
            value={selectedTeeId}
            onChange={e => setSelectedTeeId(e.target.value)}
            ref={selectRef}
          >
            <option value="">-- Choose a Tee --</option>
            {courses?.map(course => (
              <optgroup label={course.name} key={course.id}>
                {course.tees.map(tee => (
                  <option value={tee.id} key={tee.id}>
                    {tee.tee_name} (Rating: {tee.rating} / Slope: {tee.slope})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm mb-2">
            <label className="block text-sm font-semibold text-green-900 mb-1">Gross Score</label>
            <input type="number" name="gross_score" required min="30" max="200"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-600 focus:ring-green-600" />
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm mb-2">
            <label className="block text-sm font-semibold text-green-900 mb-1">Date Played</label>
            <input type="date" name="played_at" defaultValue={new Date().toISOString().split('T')[0]}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-600 focus:ring-green-600" />
          </div>
        </div>
        <button type="submit" className="w-full bg-green-600 text-white py-3 px-4 rounded-md font-semibold hover:bg-green-700 transition-colors">
          Save Round
        </button>
      </form>
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg relative">
            <button onClick={() => setShowModal(false)} className="absolute top-2 right-2 text-gray-500 hover:text-gray-700">&times;</button>
            <h2 className="text-lg font-bold mb-4">Search/Add Course</h2>
            <CourseSearch onSelect={handleCourseSelect} />
          </div>
        </div>
      )}
    </main>
  );
}

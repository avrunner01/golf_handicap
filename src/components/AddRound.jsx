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
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedTeeId, setSelectedTeeId] = useState("");
  const [selectedCourseName, setSelectedCourseName] = useState("");
  const selectRef = React.useRef(null);

  const selectedCourse = courses.find((course) => String(course.id) === selectedCourseId) || null;
  const availableTees = selectedCourse?.tees || [];
  const maxPlayedAt = new Date().toISOString().split('T')[0];

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
    console.log("Course selected:", JSON.stringify(course, null, 2));
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

    const clubName = course.club_name || course.name || "";
    const courseName = course.course_name || "";
    const fullName = clubName && courseName && clubName !== courseName
      ? `${clubName} - ${courseName}`
      : clubName || courseName;

    const payload = {
      course_name: fullName || "",
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

    if (updatedCourse) {
      setSelectedCourseId(String(updatedCourse.id));
      setSelectedCourseName(updatedCourse.name);
      if (result.selectedTeeId) {
        setSelectedTeeId(String(result.selectedTeeId));
      } else if (updatedCourse.tees.length > 0) {
        setSelectedTeeId(String(updatedCourse.tees[0].id));
      } else {
        setSelectedTeeId("");
      }
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
            <label className="block text-sm font-semibold text-green-900">Course Name</label>
            <a href="#" onClick={handleAddCourseClick} className="text-xs text-green-700 hover:underline font-semibold">+ Add Course</a>
          </div>
          <select
            name="course_id"
            required
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-600 focus:ring-green-600"
            value={selectedCourseId}
            onChange={(e) => {
              const courseId = e.target.value;
              const found = courses.find((course) => String(course.id) === courseId);
              setSelectedCourseId(courseId);
              setSelectedCourseName(found ? found.name : "");
              setSelectedTeeId("");
            }}
          >
            <option value="">-- Choose a Course --</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm mb-2">
          <label className="block text-sm font-semibold text-green-900 mb-1">Tee</label>
          <select
            name="tee_id"
            required
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-600 focus:ring-green-600"
            value={selectedTeeId}
            onChange={(e) => {
              const teeId = e.target.value;
              setSelectedTeeId(teeId);
              const found = courses.find((course) => course.tees.some((tee) => String(tee.id) === teeId));
              if (found) {
                setSelectedCourseId(String(found.id));
              }
              setSelectedCourseName(found ? found.name : "");
            }}
            ref={selectRef}
            disabled={!selectedCourseId}
          >
            <option value="">{selectedCourseId ? "-- Choose a Tee --" : "Select a course first"}</option>
            {availableTees.map((tee) => (
              <option value={tee.id} key={tee.id}>
                {tee.tee_name} (Rating: {tee.rating} / Slope: {tee.slope})
              </option>
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
            <input type="date" name="played_at" defaultValue={maxPlayedAt} max={maxPlayedAt}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-600 focus:ring-green-600" />
          </div>
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <a
            href="/dashboard"
            className="w-full rounded-md border border-gray-300 bg-white py-3 px-4 text-center font-semibold text-gray-700 hover:bg-gray-50 sm:w-auto"
          >
            Cancel
          </a>
          <button type="submit" className="w-full bg-green-600 text-white py-3 px-4 rounded-md font-semibold hover:bg-green-700 transition-colors sm:w-auto">
            Save Round
          </button>
        </div>
      </form>
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg relative">
            <button onClick={() => setShowModal(false)} className="absolute top-2 right-2 text-gray-500 hover:text-gray-700">&times;</button>
            <h2 className="text-lg font-bold mb-4">Search/Add Course</h2>
            <CourseSearch onSelect={handleCourseSelect} />
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

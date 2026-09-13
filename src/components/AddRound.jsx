import React, { useState } from "react";
import CourseSearch from "../components/CourseSearch";

const parseNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const getFirstNumber = (source, keys) => {
  for (const key of keys) {
    const value = parseNumber(source?.[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
};

const collectNestedTeeObjects = (root) => {
  const results = [];
  const stack = [{ value: root, depth: 0 }];
  const visited = new Set();
  const maxDepth = 6;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || current.depth > maxDepth) {
      continue;
    }

    const value = current.value;
    if (!value || typeof value !== "object") {
      continue;
    }

    if (visited.has(value)) {
      continue;
    }
    visited.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        stack.push({ value: item, depth: current.depth + 1 });
      }
      continue;
    }

    const keys = Object.keys(value);
    const looksLikeTee =
      keys.some((key) => ["tee", "rating", "slope", "par", "color", "gender"].includes(key))
      || keys.some((key) => key.startsWith("tee_") || key.endsWith("_rating") || key.endsWith("_slope") || key.endsWith("_par"));

    if (looksLikeTee) {
      results.push(value);
    }

    for (const childValue of Object.values(value)) {
      stack.push({ value: childValue, depth: current.depth + 1 });
    }
  }

  return results;
};

const deriveParFromHoles = (course) => {
  const candidates = collectNestedTeeObjects(course);
  const holeLists = candidates
    .filter((item) => Array.isArray(item?.holes))
    .map((item) => item.holes);

  for (const holes of holeLists) {
    const total = holes.reduce((sum, hole) => {
      const holePar = parseNumber(hole?.par ?? hole?.hole_par);
      return holePar === null ? sum : sum + holePar;
    }, 0);

    if (total > 0) {
      return total;
    }
  }

  return null;
};

const getCourseLocation = (course) => {
  if (!course?.location) {
    return null;
  }

  if (typeof course.location === "string") {
    return course.location;
  }

  if (typeof course.location === "object") {
    const parts = [course.location.city, course.location.state, course.location.country]
      .map((part) => (typeof part === "string" ? part.trim() : ""))
      .filter(Boolean);

    if (parts.length > 0) {
      return parts.join(", ");
    }
  }

  return null;
};

const getSearchResultTees = (course) => {
  const directTees = [];

  if (Array.isArray(course?.tees)) {
    directTees.push(...course.tees);
  }

  if (Array.isArray(course?.tee_boxes)) {
    directTees.push(...course.tee_boxes);
  }

  const groupedTees =
    course?.tees && typeof course.tees === "object"
      ? Object.values(course.tees).filter(Array.isArray).flat()
      : [];

  const maleTees = Array.isArray(course?.tees?.male) ? course.tees.male : [];
  const femaleTees = Array.isArray(course?.tees?.female) ? course.tees.female : [];
  const nestedTees = collectNestedTeeObjects(course);

  return [...directTees, ...groupedTees, ...maleTees, ...femaleTees, ...nestedTees];
};

const mapTeesForCreate = (course) => {
  const seen = new Set();
  const fallbackRating = getFirstNumber(course, [
    "course_rating", "rating", "usga_rating", "rating_men", "rating_women", "mens_rating", "womens_rating",
  ]);
  const fallbackSlope = getFirstNumber(course, [
    "slope_rating", "slope", "slope_men", "slope_women", "mens_slope", "womens_slope",
  ]);
  const fallbackPar =
    getFirstNumber(course, ["par", "par_total", "course_par", "pars"]) ?? deriveParFromHoles(course);

  const parsedTees = getSearchResultTees(course)
    .map((tee) => {
      const teeName =
        tee?.tee_name
        || tee?.name
        || tee?.tee
        || tee?.tee_color
        || tee?.color_code
        || tee?.color
        || tee?.gender
        || "";

      const rating = parseNumber(tee?.course_rating ?? tee?.rating ?? tee?.usga_rating ?? fallbackRating);
      const slope = parseNumber(tee?.slope_rating ?? tee?.slope ?? fallbackSlope);
      const par = parseNumber(tee?.par_total ?? tee?.par ?? tee?.total_par ?? fallbackPar);

      if (!teeName || rating === null || slope === null || par === null) {
        return null;
      }

      const colorCode = tee?.color_code || tee?.tee_color || tee?.color || teeName;
      const dedupeKey = `${teeName}|${rating}|${slope}|${par}`;

      if (seen.has(dedupeKey)) {
        return null;
      }

      seen.add(dedupeKey);
      return {
        tee_name: teeName,
        color_code: colorCode,
        rating,
        slope,
        par,
      };
    })
    .filter(Boolean);

  if (parsedTees.length > 0) {
    return parsedTees;
  }

  if (fallbackRating !== null && fallbackSlope !== null && fallbackPar !== null) {
    return [{
      tee_name: "Default Tee",
      color_code: "Default Tee",
      rating: fallbackRating,
      slope: fallbackSlope,
      par: fallbackPar,
    }];
  }

  return [];
};

const buildFallbackTee = (course) => {
  const rating = getFirstNumber(course, [
    "course_rating", "rating", "usga_rating", "rating_men", "rating_women", "mens_rating", "womens_rating",
  ]) ?? 72;
  const slope = getFirstNumber(course, [
    "slope_rating", "slope", "slope_men", "slope_women", "mens_slope", "womens_slope",
  ]) ?? 113;
  const par = getFirstNumber(course, ["par", "par_total", "course_par", "pars"]) ?? deriveParFromHoles(course) ?? 72;

  return {
    tee_name: "Default Tee",
    color_code: "Default Tee",
    rating,
    slope,
    par,
  };
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

  const redirectToLogin = () => {
    window.location.href = '/login?error=unauthorized';
  };

  // Refetch courses from API (client-side)
  const fetchCourses = async () => {
    const res = await fetch('/api/courses/list', {
      credentials: 'include',
    });

    if (res.status === 401) {
      redirectToLogin();
      return [];
    }

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
    let selectedCourseData = course;
    let tees = mapTeesForCreate(selectedCourseData);

    if (tees.length === 0 && course?.id) {
      try {
        const detailResponse = await fetch(`/api/golf-search?id=${encodeURIComponent(String(course.id))}`, {
          credentials: 'include',
        });

        if (detailResponse.ok) {
          const detailData = await detailResponse.json();
          const resolvedCourse = detailData.course || detailData;
          selectedCourseData = resolvedCourse;
          tees = mapTeesForCreate(selectedCourseData);
        }
      } catch (_) {
        // If detail fetch fails we still fall back to the existing user-facing message below.
      }
    }

    if (tees.length === 0) {
      tees = [buildFallbackTee(selectedCourseData)];
      window.alert("No tee data was returned for that course. A default tee was created so you can add the course now. You can edit tee details later.");
    }

    const clubName = selectedCourseData.club_name || selectedCourseData.name || "";
    const courseName = selectedCourseData.course_name || "";
    const fullName = clubName && courseName && clubName !== courseName
      ? `${clubName} - ${courseName}`
      : clubName || courseName;

    const payload = {
      course_name: fullName || "",
      location: getCourseLocation(selectedCourseData),
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

    if (response.status === 401) {
      redirectToLogin();
      return;
    }

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

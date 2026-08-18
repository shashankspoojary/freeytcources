/**
 * src/lib/searchEngine.js
 * YouTube-grade, fuzzy, multi-field search and ranking engine.
 */

// 1. Stop-Words Filter
export const STOP_WORDS = new Set([
  'the', 'a', 'an', 'in', 'on', 'for', 'of', 'with', 'by', 'at', 'from', 'to', 
  'how', 'best', 'free', 'course', 'courses', 'tutorial', 'tutorials', 'video', 
  'videos', 'guide', 'masterclass', 'complete', 'full'
]);

// 2. Tech Synonyms & Aliases Map
export const SYNONYMS_MAP = {
  'js': ['javascript', 'js'],
  'javascript': ['js', 'javascript'],
  'ts': ['typescript', 'ts'],
  'typescript': ['ts', 'typescript'],
  'py': ['python', 'py'],
  'python': ['py', 'python'],
  'react': ['react', 'reactjs', 'react.js'],
  'reactjs': ['react', 'reactjs'],
  'next': ['nextjs', 'next.js', 'next'],
  'nextjs': ['next', 'nextjs', 'next.js'],
  'tailwind': ['tailwind', 'tailwindcss', 'tailwind css'],
  'ai': ['artificial intelligence', 'machine learning', 'ai', 'llm', 'langchain', 'agent'],
  'ml': ['machine learning', 'ai', 'deep learning', 'pytorch'],
  'pytorch': ['pytorch', 'torch', 'deep learning'],
  'davinci': ['davinci', 'davinci resolve', 'resolve', 'color grading'],
  'premiere': ['premiere', 'premiere pro', 'pr', 'video editing'],
  'ae': ['after effects', 'motion graphics', 'vfx'],
  'dsa': ['data structures', 'algorithms', 'dsa', 'leetcode']
};

/**
 * Fuzzy Matching (Levenshtein Distance <= 2)
 */
export function isFuzzyMatch(strA, strB, maxDistance = 2) {
  if (strA === strB) return true;
  if (Math.abs(strA.length - strB.length) > maxDistance) return false;
  
  // Fast exact substring match for long strings
  if (strA.includes(strB) || strB.includes(strA)) return true;

  const track = Array(strB.length + 1).fill(null).map(() =>
    Array(strA.length + 1).fill(null)
  );

  for (let i = 0; i <= strA.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= strB.length; j += 1) {
    track[j][0] = j;
  }

  for (let j = 1; j <= strB.length; j += 1) {
    for (let i = 1; i <= strA.length; i += 1) {
      const indicator = strA[i - 1] === strB[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return track[strB.length][strA.length] <= maxDistance;
}

/**
 * Deep Multi-Field Scoring Engine
 */
export function scoreCourse(course, query, calculateCourseRank) {
  if (!query || !query.trim()) return 0;
  
  // Tokenize and lowercase
  const rawTokens = query.toLowerCase().split(/[\s,;-]+/).filter(Boolean);
  
  // Remove stop-words, but if ALL are stop-words, retain original tokens
  let tokens = rawTokens.filter(t => !STOP_WORDS.has(t));
  if (tokens.length === 0) {
    tokens = rawTokens;
  }

  // Expand tokens using SYNONYMS_MAP
  const expandedTokens = [];
  for (const token of tokens) {
    if (SYNONYMS_MAP[token]) {
      expandedTokens.push(...SYNONYMS_MAP[token]);
    } else {
      expandedTokens.push(token);
    }
  }
  
  // Deduplicate expanded tokens
  const searchTokens = [...new Set(expandedTokens)];

  let searchPoints = 0;
  let matchedTokensCount = 0;

  for (const token of searchTokens) {
    let tokenMatched = false;

    // 1. Title (Weight: +25 pts)
    if (course.title && course.title.toLowerCase().includes(token)) {
      searchPoints += 25;
      tokenMatched = true;
    } else if (course.title && isFuzzyMatch(course.title.toLowerCase(), token, 1)) {
      searchPoints += 20; // Slightly less for fuzzy match
      tokenMatched = true;
    }

    // 2. Creator (Weight: +18 pts)
    const creator = (course.creatorName || course.creator || course.author || "").toLowerCase();
    if (creator.includes(token) || isFuzzyMatch(creator, token, 1)) {
      searchPoints += 18;
      tokenMatched = true;
    }

    // 3. Chapters / Modules (Weight: +15 pts)
    const syllabus = course.chapters || course.modules || [];
    if (Array.isArray(syllabus)) {
      const syllabusMatch = syllabus.some(ch => 
        (ch.title && ch.title.toLowerCase().includes(token)) || 
        (ch.title && isFuzzyMatch(ch.title.toLowerCase(), token, 1))
      );
      if (syllabusMatch) {
        searchPoints += 15;
        tokenMatched = true;
      }
    }

    // 4. Tools (Weight: +12 pts)
    if (Array.isArray(course.tools)) {
      const toolsMatch = course.tools.some(t => 
        t.toLowerCase().includes(token) || isFuzzyMatch(t.toLowerCase(), token, 1)
      );
      if (toolsMatch) {
        searchPoints += 12;
        tokenMatched = true;
      }
    }

    // 5. Tags (Weight: +10 pts)
    if (Array.isArray(course.tags)) {
      const tagsMatch = course.tags.some(t => 
        t.toLowerCase().includes(token) || isFuzzyMatch(t.toLowerCase(), token, 1)
      );
      if (tagsMatch) {
        searchPoints += 10;
        tokenMatched = true;
      }
    }

    // 6. Category (Weight: +8 pts)
    if (course.category && (course.category.toLowerCase().includes(token) || isFuzzyMatch(course.category.toLowerCase(), token, 1))) {
      searchPoints += 8;
      tokenMatched = true;
    }

    // 7. Overview (Weight: +4 pts)
    const desc = (course.overview || course.description || "").toLowerCase();
    if (desc.includes(token)) {
      searchPoints += 4;
      tokenMatched = true;
    }

    if (tokenMatched) {
      matchedTokensCount++;
    }
  }

  // Calculate Match Coverage
  const totalQueryTokens = searchTokens.length;
  if (totalQueryTokens === 0 || matchedTokensCount === 0) return 0;
  
  const coverageRatio = matchedTokensCount / totalQueryTokens;

  // Phrase Match Boost
  if (course.title && course.title.toLowerCase().includes(query.toLowerCase())) {
    searchPoints += 40;
  }

  // Base Quality Multiplier
  const baseRank = typeof calculateCourseRank === 'function' ? calculateCourseRank(course) : (course.rating || 4.5) * (course.views || 1000);
  
  const finalScore = (searchPoints * coverageRatio) + (baseRank * 0.25);
  return finalScore;
}

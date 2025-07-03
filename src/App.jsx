 import { useEffect, useState } from "react";

import Search from "./components/search.jsx";
import MovieCard from "./components/MovieCard.jsx";
import spinner from "./components/spinner.jsx";

import { useDebounce } from "react-use";

import { getTrendingMovies,updateSearchCount } from "./appwrite.js";


const API_BASE_URL = "https://api.themoviedb.org/3";
const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

const API_OPTIONS = {
  method: "GET",
  headers: {
    accept: "application/json",
    Authorization: `Bearer ${API_KEY}`,
  },
};

const App = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [movieList, setMovieList] = useState([]);
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMovies = async (query='') => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (!API_KEY) {
        throw new Error("Missing TMDB API Key. Check your .env file.");
      }

      const endpoint = query 
        ? `${API_BASE_URL}/search/movie?query=${encodeURIComponent(query)}`
        : `${API_BASE_URL}/discover/movie?sort_by=popularity.desc`;
      const response = await fetch(endpoint, API_OPTIONS);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.Response === "False") {
        setErrorMessage(data.Error || "Failed to fetch movies");
        setMovieList([]);
        return;
      }

      setMovieList(data.results || []);

      if (query && data.results.length > 0) {
       await updateSearchCount(query, data.results[0]);
      }

    } catch (error) {
      console.error(`Error fetching movies: ${error}`);
      setErrorMessage('Error fetching movies. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTrendingMovies = async () => {
    try {
      // First try to get trending movies from Appwrite
      const appwriteTrending = await getTrendingMovies();
      if (appwriteTrending && appwriteTrending.length > 0) {
        setTrendingMovies(appwriteTrending);
        return;
      }

      // Fallback to TMDB API if Appwrite doesn't have data
      if (!API_KEY) {
        throw new Error("Missing TMDB API Key. Check your .env file.");
      }

      const endpoint = `${API_BASE_URL}/trending/movie/week`;
      const response = await fetch(endpoint, API_OPTIONS);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const trendingResults = data.results || [];
      
      setTrendingMovies(trendingResults);

      // Save trending movies to Appwrite for future use
      if (trendingResults.length > 0) {
        await saveTrendingMovies(trendingResults.slice(0, 20)); // Save top 20
      }

    } catch (error) {
      console.error(`Error fetching trending movies: ${error}`);
      // If all fails, try to get from Appwrite cache anyway
      try {
        const fallbackTrending = await getTrendingMovies();
        setTrendingMovies(fallbackTrending || []);
      } catch (appwriteError) {
        console.error(`Appwrite fallback failed: ${appwriteError}`);
      }
    }
  };

  useEffect(() => {
    fetchMovies();
    fetchTrendingMovies();
  }, []);

  // Debounce the search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch movies when debounced search term changes
  useEffect(() => {
    if (debouncedSearchTerm.trim()) {
      fetchMovies(debouncedSearchTerm);
    } else {
      fetchMovies();
    }
  }, [debouncedSearchTerm]);

  return (
    <main>
      <div className="pattern" />

      <div className="wrapper">
        <header>
          <img src="/hero.png" alt="Hero Banner" />
          <h1>
            Find <span className="text-gradient">Movies</span> You'll Enjoy
            Without the Hassle
          </h1>
          <Search searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
        </header>

        <section className="Trending-Movies">
          <h2 className="mt-[40px]">Trending Movies</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-8">
            {trendingMovies.slice(0, 5).map((movie) => (
              <MovieCard key={movie.id} movie={movie}/>
            ))}
          </div>
        </section>

        <section className="All-Movies">
          <h2 className="mt-[40px]">All Movies</h2>
          
          {isLoading ? (
            <p className="text-white">Loading ...</p>
          ) : errorMessage ? (
            <p className="text-red-500">{errorMessage}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-8">
              {movieList.map((movie) => (
               <MovieCard key={movie.id} movie={movie}/>
              ))}
            </div>
          )}

          {errorMessage && <p className="text-red-500">{errorMessage}</p>}
        </section>

      
      </div>
    </main>
  );
};

export default App;  

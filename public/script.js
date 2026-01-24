document.addEventListener("DOMContentLoaded", function () {
  const questionFormQuestions = document.getElementById("questionFormQuestions");
  const questionFormFeud = document.getElementById("questionFormFeud");
  const clearFormBtn = document.getElementById("clearForm");
  const editQuestionBtn = document.getElementById("editQuestionQuestions");
  const deleteQuestionBtn = document.getElementById("deleteQuestionQuestions");
  const searchQuestionsInput = document.getElementById("searchQuestions");
  const questionsDisplayQuestions = document.getElementById("questionsDisplayQuestions");
  const musicQuestionsDisplay = document.getElementById("musicQuestionsDisplay");
  const musicSearchRight = document.getElementById("musicSearchRight");
  const questionCountSpan = document.getElementById("questionCount");
  const imageFormSection = document.querySelector(".questions-image-input");
  const clearImageFormBtn = document.getElementById("clearImageForm");
  const editImageBtn = document.getElementById("editImage");
  const editImageSong = document.getElementById("editImageSong");
  const deleteImageBtn = document.getElementById("deleteImage");
  const uploadImageBtn = document.getElementById("uploadImage");
  const submitImageOnlyBtn = document.querySelector(".sub-img");
  const searchImages = document.getElementById("searchImages");
  const searchImagesMusic = document.getElementById("searchImagesMusic");
  const imageSearchResults = document.getElementById("imageSearchResults");
  const imagePreview = document.getElementById("imagePreview");
  const fileInput = document.getElementById("imageFile");
  const cropperContainer = document.getElementById("cropperContainer");
  const cropperImage = document.getElementById("cropperImage");
  const cropImageBtn = document.getElementById("cropImageBtn");
  const resetCropBtn = document.getElementById("resetCropBtn");

  const searchRightMov = document.getElementById("imageSearchResultsMovieRight");
  const searchLeftMov = document.getElementById("imageSearchResultsMovie");


  const musicEditorSection = document.getElementById("musicEditorSection");
  const musicFileInput = document.getElementById("musicFile");
  const playPauseBtn = document.getElementById("playPauseBtn");
  const stopBtn = document.getElementById("stopBtn");
  const applyCropBtn = document.getElementById("applyCropBtn");
  const saveBtn = document.getElementById("saveBtn");
  const cropStartInput = document.getElementById("cropStart");
  const cropEndInput = document.getElementById("cropEnd");
  const gainRange = document.getElementById("gainRange");
  const lowFilterRange = document.getElementById("lowFilterRange");
  const editSongBtn = document.getElementById("editSong");

  const movieSection = document.getElementById("moviesSec");
  const deleteSongBtn = document.getElementById("deleteSong");
  const deleteImageSongBtn = document.getElementById("deleteImageSong");
  const feudSection = document.getElementById("feud-input");
  const clearFeudFormBtn = document.getElementById("clearFeudForm");
  const editFeudQuestionBtn = document.getElementById("editFeudQuestion");
  const submitFeudBtn = document.getElementById("submitFeud");
  const searchFeudQuestionsInput = document.getElementById("searchFeudQuestions");
  const questionsDisplayFeud = document.getElementById("questionsDisplayFeud");
  const feudQuestionCountSpan = document.getElementById("feudQuestionCount");

  let currentQuestionId = null;
  let currentImageId = null;
  let currentSongId = null;
  let currentFeudId = null;
  let currentMovieIdRight = null;
  let cropper = null;
  let croppedBlob = null;
  let wavesurfer = null;
  let originalBuffer = null;
  let audioContext = null;
  let gainNode = null;
  let filterNode = null;
  let croppedBuffer = null;
  let categories = [];
  let isLoading = false;

  // Loading spinner element (already in HTML/CSS, we just show/hide):
  const loadingSpinner = document.getElementById("loadingSpinner");

  const musicSearchInput = document.querySelector(".musicSearchInput");

if (musicSearchInput) {
  musicSearchInput.addEventListener("input", (e) => {
    const query = e.target.value.trim();
    fetchSongsSearch(query);
  });
}


  // function showLoading() {
  //   isLoading = true;
  //   loadingSpinner.style.display = "block";
  // }

  function hideLoading() {
    isLoading = false;
    loadingSpinner.style.display = "none";
  }

//Button Submission
//   document.getElementById('mainForm').addEventListener('submit', function (event) {
//     const submitType = event.submitter.value; // Detect which button was clicked
//     this.action = submitType === "question" ? "/add-question" : "/upload-image";
// });

  // Initialize WaveSurfer
  function initializeWaveSurfer() {
    if (wavesurfer) wavesurfer.destroy();
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    wavesurfer = WaveSurfer.create({
      container: '#waveform',
      waveColor: '#6a1b9a',
      progressColor: '#00ecbc',
      cursorColor: '#333',
      barWidth: 2,
      height: 100,
      responsive: true,
      backend: 'WebAudio',
      plugins: [WaveSurfer.regions.create({ dragSelection: true })]
    });

    gainNode = audioContext.createGain();
    filterNode = audioContext.createBiquadFilter();
    filterNode.type = 'lowshelf';
    filterNode.gain.value = 15;

    wavesurfer.on('ready', () => {
      const source = audioContext.createMediaElementSource(wavesurfer.media);
      source.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(audioContext.destination);
      wavesurfer.clearRegions();
      wavesurfer.addRegion({
        start: 0,
        end: wavesurfer.getDuration() / 2,
        color: 'rgba(0, 236, 188, 0.2)',
        drag: true,
        resize: true
      });
      cropEndInput.value = wavesurfer.getDuration().toFixed(2);
    });

    wavesurfer.on('region-created', (region) => {
      cropStartInput.value = region.start.toFixed(2);
      cropEndInput.value = region.end.toFixed(2);
    });

    wavesurfer.on('region-updated', (region) => {
      cropStartInput.value = region.start.toFixed(2);
      cropEndInput.value = region.end.toFixed(2);
    });
  }

// ✅ Fetch categories and populate dropdown
async function fetchCategories() {
  showLoading();
  try {
    const response = await fetch('http://localhost:4001/categories');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.success) {
      categories = data.categories; // Should include id, name, and slug
    } else {
      throw new Error("Server returned an unsuccessful response.");
    }
  } catch (error) {
    console.error('Error fetching categories:', error);
    alert(
      `Error connecting to server while fetching categories: ${error.message}\nWould you like to retry?`
    );
    const retry = confirm("Retry fetching categories?");
    if (retry) {
      return await fetchCategories(); // Retry
    }

    // ✅ Fallback: use correct slug + name
    categories = [
      { id: 1, category_slug: "american-history", category_name: "American History" },
      { id: 2, category_slug: "geography", category_name: "Geography" },
      { id: 3, category_slug: "sports", category_name: "Sports" },
      { id: 4, category_slug: "science-tech", category_name: "Science & Tech" },
      { id: 5, category_slug: "who-am-i", category_name: "Who Am I?" },
      { id: 6, category_slug: "name-that-song", category_name: "Music Rounds" },
      { id: 7, category_slug: "arts-literature", category_name: "Arts & Literature" },
      { id: 8, category_slug: "random", category_name: "Random" },
      { id: 9, category_slug: "entertainment", category_name: "Entertainment" },
      { id: 10, category_slug: "feud", category_name: "Feud" },
      { id: 11, category_slug: "nature", category_name: "Nature" },
      { id: 12, category_slug: "name-that-artist", category_name: "Music Rounds" },
      { id: 13, category_slug: "world-history", category_name: "World History" },
      { id: 14, category_slug: "wager-round", category_name: "Wager Round" },
      { id: 15, category_slug: "movies", category_name: "Movies" }
    ];
} finally {
  const categorySelects = document.querySelectorAll('#categoryQuestions, #categoryFeud');
  
  // ✅ Use this to populate <select> with data-id
categorySelects.forEach(select => {
  select.innerHTML = categories
    .map(cat => `<option value="${cat.id}">${cat.category_name}</option>`)
    .join('');
});


  // ✅ Optional: Set default category
  updateQuestionCount(categories[0].category_slug);

  hideLoading();
}

}

  async function updateQuestionCount(categoryId) {
    try {
      const response = await fetch(
        `http://localhost:4001/questions?category=${encodeURIComponent(categoryId)}`
      );
      const data = await response.json();
      if (data.success) {
        questionCountSpan.textContent = data.questions.length || 0;
      } else {
        questionCountSpan.textContent = "0";
      }
    } catch (error) {
      console.error("Error fetching question count:", error);
      questionCountSpan.textContent = "0";
    }

    if (categoryId === "feud") {
      try {
        const response = await fetch(
          `http://localhost:4001/feud-questions?category=${encodeURIComponent(categoryId)}`
        );
        const data = await response.json();
        if (data.success) {
          feudQuestionCountSpan.textContent = data.questions.length || 0;
        } else {
          feudQuestionCountSpan.textContent = "0";
        }
      } catch (error) {
        console.error("Error fetching feud question count:", error);
        feudQuestionCountSpan.textContent = "0";
      }
    }
  }

//Updated toggle functions for Music Editor and Feud Sections
  function toggleMusicEditor(category) {
    const isMusicRounds = category === "music-rounds";
    const isFeud = category === "feud";
    const isMovies = category === "movies";
    
    const questSection = document.getElementById("quest-section");
    const bandSongSec = document.getElementById("bandSongsec");
    const movieEntrySection = document.getElementById("moviesSec");
    const feudSection = document.getElementById("feud-input");

    musicEditorSection.style.display = isMusicRounds ? "block" : "none";

    if (questSection) {
        questSection.style.display = (isMusicRounds || isFeud) ? "none" : "block";
    }

    if (bandSongSec) {
        bandSongSec.style.display = isMusicRounds ? "block" : "none";
    }

    if (feudSection) {
        feudSection.style.display = isFeud ? "block" : "none";
    }

    if (movieEntrySection) {
      movieEntrySection.style.display = isMovies ? "block" : "none";
    }

    editSongBtn.style.display = isMusicRounds ? "inline-flex" : "none";
    deleteSongBtn.style.display = isMusicRounds ? "inline-flex" : "none";
    editQuestionBtn.style.display = isMusicRounds ? "none" : "inline-flex";
    deleteQuestionBtn.style.display = isMusicRounds ? "none" : "inline-flex";

    const multipleChoiceContainer = document.getElementById("multipleChoiceContainer");
    const tagsQuestions = document.getElementById("tagsQuestions-con");

    if (multipleChoiceContainer) {
        multipleChoiceContainer.style.visibility = isMusicRounds ? "hidden" : "visible";
    }

    if (tagsQuestions) {
        tagsQuestions.style.display = isMusicRounds ? "none" : "block";
    }

    document.querySelectorAll(".quest, .ans, .wrongans").forEach(el => {
        el.style.display = (isMusicRounds || isFeud) ? "none" : "block";
    });

    if (isMusicRounds && !wavesurfer) {
        initializeWaveSurfer();
    }
}

function toggleFeudSection(selectedValue) {
    const isFeud = selectedValue === "feud";

    const questionsSec = document.getElementById("quest-section");
    const questionsInput = document.getElementById("questions-input");
    const feudSection = document.getElementById("feud-input");

    if (feudSection) {
        feudSection.style.display = isFeud ? "block" : "none";
    }

    if (questionsSec) {
        questionsSec.style.display = isFeud ? "none" : "block";
    }

    if (questionsInput) {
        questionsInput.style.display = isFeud ? "none" : "block";
    }

    document.querySelectorAll(".quest, .ans, .wrongans").forEach(el => {
        el.style.display = isFeud ? "none" : "block";
    });

    if (isFeud) {
        feudSection.scrollIntoView({ behavior: "smooth" });
    } else {
        updateQuestionCount(selectedValue);
    }
}

function toggleMovieSection(selectedValue) {
  const isMovie = selectedValue === "movies";
  const isFeud = selectedValue === "feud";
  const isMusic = selectedValue === "music-rounds";
  const isWager = selectedValue === "wager-round";

  const showStandard = !isMovie && !isFeud && !isMusic && !isWager;

  const questionsContainer = document.getElementById("questions-container");
  const movieSection = document.getElementById("moviesSecLeft");
  const movieSec = document.getElementById("moviesSec");
  const feudSection = document.getElementById("feud-input");
  const bandSongsec = document.getElementById("bandSongsec");
  const musicEditorSection = document.getElementById("musicEditorSection");
  const wagerLeft = document.getElementById("wagerLeft");
  const wagerRight = document.getElementById("wagerRight");

  const questionsInput = document.getElementById("questions-input");
  const questionsImageInput = document.getElementById("questions-image-input");

  // Reset all sections
  if (questionsContainer) questionsContainer.style.display = "flex";
  if (movieSection) movieSection.style.display = "none";
  if (movieSec) movieSec.style.display = "none";
  if (feudSection) feudSection.style.display = "none";
  if (bandSongsec) bandSongsec.style.display = "none";
  if (musicEditorSection) musicEditorSection.style.display = "none";
  if (wagerLeft) wagerLeft.style.display = "none";
  if (wagerRight) wagerRight.style.display = "none";
  if (questionsInput) questionsInput.style.display = "none";
  if (questionsImageInput) questionsImageInput.style.display = "none";

  // Show relevant section
  if (isMovie) {
    movieSection?.scrollIntoView({ behavior: "smooth" });
    if (movieSection) movieSection.style.display = "block";
    if (movieSec) movieSec.style.display = "block";
  } else if (isFeud) {
    feudSection?.scrollIntoView({ behavior: "smooth" });
    feudSection.style.display = "block";
  } else if (isMusic) {
    bandSongsec?.scrollIntoView({ behavior: "smooth" });
    bandSongsec.style.display = "block";
    musicEditorSection.style.display = "block";
  } else if (isWager) {
    wagerLeft?.scrollIntoView({ behavior: "smooth" });
    wagerLeft.style.display = "block";
    wagerRight.style.display = "block";
  } else if (showStandard) {
    // Standard question types
    questionsInput?.scrollIntoView({ behavior: "smooth" });
    questionsInput.style.display = "block";
    questionsImageInput.style.display = "block";
    updateQuestionCount(selectedValue); // Fetch count if needed
  }
}

const categorySelects = document.querySelectorAll('#categoryQuestions, #categoryFeud');

categorySelects.forEach(select => {
  select.addEventListener("change", function () {
    const selectedValue = this.value;

    categorySelects.forEach(el => (el.value = selectedValue));

    const selectedOption = this.options[this.selectedIndex];
    const selectedCategoryId = selectedOption.getAttribute("data-id");

    const categoryIdInput = document.getElementById("categoryId");
    if (categoryIdInput) {
      categoryIdInput.value = selectedCategoryId;
    }

    toggleMovieSection(selectedValue); // ✅ make sure this function is defined above
    toggleFeudSection?.(selectedValue);
    toggleMusicEditor?.(selectedValue);

    if (selectedValue === "music-rounds") {
      fetchSongs(selectedValue);
    } else if (selectedValue === "feud") {
      fetchFeudQuestions(selectedValue);
    } else {
      fetchQuestions(selectedValue);
    }
  });
});


// Fetch categories once DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("questionFormQuestions");
  if (!form) {
    console.error("Form element with ID 'questionFormQuestions' not found.");
    return;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const categoryElement = document.getElementById("categoryQuestions");
    if (!categoryElement) {
      alert("Category selection is required.");
      return;
    }

    const categoryId = document.getElementById("categoryId")?.value;
    const categorySlug = categoryElement.value; // for conditional logic

    if (!categoryId) {
      alert("❌ Category ID is missing (check data-id in <option>)");
      return;
    }

    let formData = {};

    if (categorySlug === "music-rounds") {
      const musicFileInput = document.getElementById("musicFile");
      const selectedFile = musicFileInput?.files?.[0];

      formData = {
        file: croppedBuffer
          ? await audioBufferToWaveBlob(croppedBuffer)
          : selectedFile,
        categoryId,
        artistName: document.getElementById("artistName")?.value.trim() || "",
        songTitle: document.getElementById("songTitle")?.value.trim() || "",
        wrongName: document.getElementById("wrongName")?.value.trim() || "",
        wrongTitle: document.getElementById("wrongTitle")?.value.trim() || "",
        featuring: document.getElementById("featuring")?.value.trim() || "",
        musicTags: document.getElementById("musicTags")?.value.trim() || ""
      };

      console.log("🎵 Music Form Data Before Submission:", formData);
      if (!formData.file) {
        console.error("❌ No file selected for upload!");
        alert("Please select a music file.");
        return;
      }

    } else if (categorySlug === "feud") {
      formData = {
        categoryId,
        feudQuestionText: document.getElementById("feudQuestionText")?.value.trim() || "",
        answers: [
          document.getElementById("answer1")?.value.trim(),
          document.getElementById("answer2")?.value.trim(),
          document.getElementById("answer3")?.value.trim(),
          document.getElementById("answer4")?.value.trim()
        ].filter(answer => answer)
      };

    } else {
      formData = {
        categoryId,
        questionText: document.getElementById("questionText")?.value.trim() || "",
        answer: document.getElementById("answer")?.value.trim() || "",
        wrongAnswers: document.getElementById("wrongAnswer")?.value.trim()
          ? document.getElementById("wrongAnswer").value.split(",").map(a => a.trim())
          : [],
        tags: document.getElementById("tagsQuestions")?.value.trim() || "",
        multipleChoice: document.getElementById("multipleChoice")?.checked || false
      };
    }

    console.log("📋 Form Data Before Validation:", formData);

    if (!validateForm(categorySlug, formData)) return;

    showLoading();
    try {
      let response, result;

      if (categorySlug === "music-rounds") {
        const formDataObj = new FormData();
        formDataObj.append("song", formData.file, `${formData.songTitle}.wav`);
        formDataObj.append("categoryId", categoryId);
        formDataObj.append("artistName", formData.artistName);
        formDataObj.append("songTitle", formData.songTitle);
        formDataObj.append("wrongName", formData.wrongName);
        formDataObj.append("wrongTitle", formData.wrongTitle);
        formDataObj.append("featuring", formData.featuring);
        formDataObj.append("musicTags", formData.musicTags);

        console.log("🚀 Sending Music FormData:", Array.from(formDataObj.entries()));

        response = await fetch("http://127.0.0.1:4001/add-song", {
          method: "POST",
          body: formDataObj
        });

      } else {
        console.log("🚀 Sending Question JSON:", JSON.stringify(formData, null, 2));

        response = await fetch("http://127.0.0.1:4001/add-question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        });
      }

      if (!response.ok) {
        console.error("❌ Server Response Error:", response);
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      result = await response.json();
      console.log("✅ Server Response Data:", result);

      if (result.success) {
        alert(`${categorySlug === "music-rounds" ? "Song" : "Question"} added successfully!`);
        categorySlug === "music-rounds" ? clearMusicForm() : clearQuestionForm();
        categorySlug === "music-rounds" ? fetchSongs(categorySlug) : fetchQuestions(categorySlug);
        updateQuestionCount(categorySlug);
      } else {
        alert(`❌ Error: ${result.error || "Unknown error"}`);
      }

    } catch (error) {
      console.error("❌ Error submitting form:", error);
      alert("Failed to submit: " + error.message);
    } finally {
      hideLoading();
    }
  });
});

//  Unified Toggle Function (toggleCategoryUI)
function toggleCategoryUI(slug) {
  const isMusic = slug === "music-rounds";
  const isFeud = slug === "feud";
  const isMovie = slug === "movies";
  const isWager = slug === "wager-round";
  const showStandard = !isMusic && !isFeud && !isMovie && !isWager;

  const questionsContainer = document.getElementById("questions-container");
  const questionsInput = document.getElementById("questions-input");
  const questionsImageInput = document.getElementById("questions-image-input");

  const bandSongsec = document.getElementById("bandSongsec");
  const musicEditorSection = document.getElementById("musicEditorSection");
  const feudSection = document.getElementById("feud-input");
  const movieSection = document.getElementById("moviesSec");
  const wagerLeft = document.getElementById("wagerLeft");
  const wagerRight = document.getElementById("wagerRight");

  if (questionsContainer) questionsContainer.style.display = showStandard || isMusic ? "flex" : "none";
  if (questionsInput) questionsInput.style.display = showStandard ? "block" : "none";
  if (questionsImageInput) questionsImageInput.style.display = showStandard ? "block" : "none";

  if (bandSongsec) bandSongsec.style.display = isMusic ? "block" : "none";
  if (musicEditorSection) musicEditorSection.style.display = isMusic ? "block" : "none";

  if (feudSection) feudSection.style.display = isFeud ? "block" : "none";

  if (movieSection) movieSection.style.display = isMovie ? "block" : "none";

  if (wagerLeft) wagerLeft.style.display = isWager ? "block" : "none";
  if (wagerRight) wagerRight.style.display = isWager ? "block" : "none";

  if (isMusic) {
    initializeWaveSurfer(); // or toggleMusicEditor()
  }
}


function validateForm(categoryId, formData) {
  if (!formData) {
      alert("Invalid form data.");
      return false;
  }

  if (categoryId === "music-rounds") {
      if (!formData.file) {
          alert("Music file is required.");
          return false;
      }
      if (!formData.songTitle.trim()) {
          alert("Song title is required.");
          return false;
      }
      if (!formData.artistName.trim()) {
          alert("Artist name is required.");
          return false;
      }
  } else if (categoryId === "feud") {
      if (!formData.feudQuestionText.trim()) {
          alert("Family Feud question is required.");
          return false;
      }
      if (!formData.answers.length) {
          alert("At least one answer is required.");
          return false;
      }
  } else {
      if (!formData.questionText.trim()) {
          alert("Question text is required.");
          return false;
      }
      if (!formData.answer.trim()) {
          alert("Answer is required.");
          return false;
      }
      if (!Array.isArray(formData.wrongAnswer)) {
          alert("Wrong answers should be a valid array.");
          return false;
      }
  }

  return true;
}

function showLoading() {
  console.log("🔄 Loading...");
}

function hideLoading() {
  console.log("✅ Loading finished.");
}

function clearMusicForm() {
  document.getElementById("musicFile").value = "";
  document.getElementById("artistName").value = "";
  document.getElementById("songTitle").value = "";
  document.getElementById("featuring").value = "";
  document.getElementById("musicTags").value = "";
  document.getElementById("wrongName").value = "";
  document.getElementById("wrongTitle").value = "";
}

function clearQuestionForm() {
  document.getElementById("questionText").value = "";
  document.getElementById("correctAnswer").value = "";
  document.getElementById("wrongAnswer").value = "";
  document.getElementById("tagsQuestions").value = "";
  document.getElementById("imageFile").value = "";
  document.getElementById("multipleChoice").checked = false;
}

function fetchSongs(categoryId) {
  console.log(`🎶 Fetching songs for category: ${categoryId}`);
}

function fetchQuestions(categoryId) {
  console.log(`📝 Fetching questions for category: ${categoryId}`);
}

function updateQuestionCount(categoryId) {
  console.log(`🔢 Updating question count for category: ${categoryId}`);
}

  // Feud question: only handle with the 'Submit' button
  submitFeudBtn.addEventListener("click", async function (e) {
    e.preventDefault();
    const categoryId = document.getElementById("categoryFeud").value;
    const feudQuestionText = document.getElementById("feudQuestionText").value.trim();
    const answer1 = document.getElementById("answer1").value.trim();
    const answer2 = document.getElementById("answer2").value.trim();
    const answer3 = document.getElementById("answer3").value.trim();
    const answer4 = document.getElementById("answer4").value.trim();
    const altAns = document.getElementById("alternateAnswer").value.trim();
    const tags = document.getElementById("feudTags").value.trim();

    if (!feudQuestionText || !answer1 || !answer2 || !answer3 || !answer4) {
      alert("Please enter a question and all four answers for the Feud round.");
      return;
    }

    const feudData = {
      categoryId,
      questionText: feudQuestionText,
      answers: [
        { text: answer1, points: 4 },
        { text: answer2, points: 3 },
        { text: answer3, points: 2 },
        { text: answer4, points: 1 }
      ],
      alternateAnswer: altAns,
      tags
    };

    showLoading();
    try {
      const response = await fetch("http://localhost:4001/add-feud-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feudData)
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        alert("Feud question added successfully!");
        clearFeudForm();
        fetchFeudQuestions(categoryId);
      } else {
        alert("Error adding feud question: " + result.error);
      }
    } catch (error) {
      console.error("Error submitting feud question:", error);
      alert("Failed to connect to the server while adding feud question: " + error.message);
    } finally {
      hideLoading();
    }
  });

  // Clear form buttons
  clearFormBtn.addEventListener("click", function () {
    const categoryId = document.getElementById("categoryQuestions").value;
    if (categoryId === "music-rounds") {
      clearMusicForm();
      currentSongId = null;
    } else {
      clearQuestionForm();
      currentQuestionId = null;
      setTimeout(() => {
        location.reload();
      }, 1000);
      
    }
  });

  clearFeudFormBtn.addEventListener("click", function () {
    clearFeudForm();
    currentFeudQuestionId = null;
  });

  function clearQuestionForm() {
    questionFormQuestions.reset();
    questionsDisplayQuestions.innerHTML = "";
    editQuestionBtn.textContent = "Edit";
    deleteQuestionBtn.style.display = "inline-flex";
  }

  function clearMusicForm() {
    musicFile.value = "";
    document.getElementById("artistName").value = "";
    document.getElementById("songTitle").value = "";
    document.getElementById("featuring").value = "";
    document.getElementById("musicTags").value = "";
    document.getElementById("wrongName").value = "";
    document.getElementById("wrongTitle").value = "";
    cropStartInput.value = "0";
    cropEndInput.value = "0";
    gainRange.value = "1";
    lowFilterRange.value = "20";
    if (wavesurfer) {
      wavesurfer.destroy();
      initializeWaveSurfer();
    }
    playPauseBtn.textContent = "Play";
    editSongBtn.textContent = "Edit Song";
    originalBuffer = null;
    croppedBuffer = null;
  }

  function clearFeudForm() {
    questionFormFeud.reset();
    questionsDisplayFeud.innerHTML = "";
    editFeudQuestionBtn.textContent = "Edit";
  }

 // Fetch standard questions
// ✅ Define this first
function renderQuestions(questions) {
  const container = document.getElementById('questions-container');
  container.innerHTML = '';

  questions.forEach((question, index) => {
    const qDiv = document.createElement('div');
    qDiv.className = 'question';
    qDiv.innerHTML = `
      <p><strong>Q${index + 1}:</strong> ${question.question_text}</p>
    `;
    container.appendChild(qDiv);
  });
}

// ✅ Then define fetchQuestions
async function fetchQuestions(categoryId) {
  showLoading();
  try {
    const response = await fetch(
      `http://localhost:4001/questions?category=${encodeURIComponent(categoryId)}`
    );

    const data = await response.json();
    console.log("✅ Questions fetched:", data);

    if (!data.success || !data.questions) {
      console.error("❌ Error: No questions found");
      return;
    }

    renderQuestions(data.questions);
  } catch (error) {
    console.error("❌ Fetch error:", error);
  } finally {
    hideLoading();
  }
}

// Fetch songs by search (music-rounds)
async function fetchSongsSearch(query) {
  const musicQuestionsDisplay = document.querySelector(".musicQuestionsDisplay");
  showLoading();

  try {
    const response = await fetch(`http://localhost:4001/music_questions/search?query=${encodeURIComponent(query)}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && Array.isArray(data.musicQuestions) && data.musicQuestions.length > 0) {
      musicQuestionsDisplay.innerHTML = data.musicQuestions
        .map((s) => {
          return `
          <table class="song-table" data-id="${s.id}" border="1" cellpadding="10" cellspacing="0" style="margin-bottom: 1rem; width: 100%; text-align: center;">
            <thead style="background: linear-gradient(#2575fc);">
              <tr>
                <th>Song</th>
                ${s.band_name ? `<th>Band</th>` : ""}
                ${s.featuring ? `<th>Featuring</th>` : ""}
                ${s.music_tags ? `<th>Tags</th>` : ""}
                ${s.uploaded_song ? `<th>Audio</th>` : ""}
                ${s.image_file ? `<th>Image</th>` : ""}

              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${s.song_title} by ${s.artist_name}</td>
                ${s.band_name ? `<td>${s.band_name}</td>` : ""}
                ${s.featuring ? `<td>${s.featuring}</td>` : ""}
                ${s.music_tags ? `<td>${s.music_tags}</td>` : ""} 
                ${s.uploaded_song ? `
                  <td>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <audio controls src="/uploads/${s.uploaded_song}" style="width: 250px;"></audio>
  
                    </div>
                  </td>` : ""}
                ${s.image_file ? `<td><img src="/uploads/${s.image_file}" alt="Song Image" style="max-width: 150px;" /></td>` : ""}
              </tr>
              <tr>
                <td colspan="${[
                  'song_title',
                  s.band_name && 'band_name',
                  s.featuring && 'featuring',
                  s.music_tags && 'music_tags',
                  s.uploaded_song && 'uploaded_song',
                  s.image_file && 'image_file'
                ].filter(Boolean).length}" style="text-align: right; padding-top: 10px;">
                  <button class="select-song" data-song='${JSON.stringify(s).replace(/'/g, "&apos;")}'>Select</button>
                </td>
              </tr>
            </tbody>
          </table>
        `;        
        })
        .join("<hr>");

        
      // 🎯 Add event listeners for "Select" buttons
      document.querySelectorAll(".select-song").forEach((button) => {
        button.addEventListener("click", () => {
          const songData = JSON.parse(button.dataset.song.replace(/&apos;/g, "'"));
          populateSongForEditing(songData); // ✅ Fill form and set ID
          alert(`🎶 Selected: ${songData.song_title} by ${songData.artist_name}`);
        });
      });

    } else {
      musicQuestionsDisplay.innerHTML = "<p>No songs found.</p>";
    }
  } catch (error) {
    console.error("Error fetching songs:", error);
    musicQuestionsDisplay.innerHTML = `<p>Error loading songs: ${error.message}</p>`;
  } finally {
    hideLoading();
  }
}

// Event listener for select-song button
document.addEventListener("click", function (event) {
  if (event.target.classList.contains("select-song")) {
    const songData = JSON.parse(event.target.getAttribute("data-song"));

    currentSongId = songData.id;

    // Auto-fill form fields
    document.getElementById("songTitle").value = songData.song_title || "";
    document.getElementById("artistName").value = songData.artist_name || "";
    document.getElementById("bandName").value = songData.band_name || "";
    document.getElementById("featuring").value = songData.featuring || "";
    document.getElementById("musicTags").value = songData.music_tags || "";
    document.getElementById("wrongName").value = songData.wrong_name || "";
    document.getElementById("wrongTitle").value = songData.wrong_title || "";
    document.getElementById("wrongAnswerMusic").value = songData.wrong_answer_music || "";
    document.getElementById("songField").value = songData.song_title_right || "";
    document.getElementById("rightsecTagsMusic").value = songData.music_tags_right || "";

    // Set audio preview
    const audioElement = document.getElementById("songAudio");
    if (audioElement) {
      audioElement.src = songData.uploaded_song ? `/uploads/${songData.uploaded_song}` : "";
    }

    // Set image preview
    const imagePreviewMusic = document.getElementById("imagePreviewMusic");
    if (imagePreviewMusic) {
      if (songData.image_file) {
        imagePreviewMusic.innerHTML = `
          <img src="/uploads/${songData.image_file}" 
               alt="Preview" 
               style="max-width: 100%; height: auto; border-radius: 5px;" />
        `;
      } else {
        imagePreviewMusic.innerHTML = `
          <strong class="image-preview-textMusic" id="image-preview-textMusic">
            Drag and drop an image here, or select image from database
          </strong>
        `;
      }
    }

    // Change the button label to "Update"
    const editBtn = document.getElementById("editSong");
    if (editBtn) {
      editBtn.textContent = "Update";
      editBtn.id = "updateSong"; // Optional: change ID if needed
    }
    
    // Optionally, set the image preview
    document.getElementById("songImage").src = songData.image_file ? `/uploads/${songData.image_file}` : "";

    // Optionally disable some fields
    document.getElementById("songTitle").setAttribute("disabled", "true");
    document.getElementById("artistName").setAttribute("disabled", "true");
    document.getElementById("bandName").setAttribute("disabled", "true");
  }
});

// Fetch feud questions
// Fetch feud questions
async function fetchFeudQuestions(categoryId) {
  showLoading();
  try {
    const response = await fetch(
      `http://localhost:4001/feud-questions?category=${encodeURIComponent(categoryId)}`
    );

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    console.log('Fetched data:', data);

    const questionsDisplayFeud = document.getElementById('questionsDisplayFeud');

    if (data.success && Array.isArray(data.feudQuestions) && data.feudQuestions.length > 0) {
      questionsDisplayFeud.innerHTML = data.feudQuestions.map(q => `
        <table class="feud-table" data-id="${q.question_id}" border="1" cellpadding="10" cellspacing="0" style="margin-bottom: 1rem; width: 100%; text-align: center;">
          <thead style="background: linear-gradient(#2575fc);">
            <tr>
              <th>Question</th>
              <th>Answer 1</th>
              <th>Answer 2</th>
              <th>Answer 3</th>
              <th>Answer 4</th>
              ${q.alternate_answer ? `<th>Alternate Answer</th>` : ""}
              ${q.tags ? `<th>Tags</th>` : ""}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${q.question_text || "—"}</td>
              <td>${q.answers[0]?.text || "—"} (${q.answers[0]?.points || 0} points)</td>
              <td>${q.answers[1]?.text || "—"} (${q.answers[1]?.points || 0} points)</td>
              <td>${q.answers[2]?.text || "—"} (${q.answers[2]?.points || 0} points)</td>
              <td>${q.answers[3]?.text || "—"} (${q.answers[3]?.points || 0} points)</td>
              ${q.alternate_answer ? `<td>${q.alternate_answer}</td>` : ""}
              ${q.tags ? `<td>${q.tags}</td>` : ""}
              <td>
                <button 
                        class="select-feud-question" 
                        data-id="${q.question_id}"
                        data-question='${JSON.stringify({
                          question_text: q.question_text,
                          alternate_answer: q.alternate_answer,
                          tags: q.tags,
                          answer1: q.answers[0]?.text,
                          answer2: q.answers[1]?.text,
                          answer3: q.answers[2]?.text,
                          answer4: q.answers[3]?.text,
                        }).replace(/'/g, "&apos;")}'
                      >
                        Select
                      </button>

              </td>
            </tr>
          </tbody>
        </table>
        <hr>
      `).join("");
    } else {
      questionsDisplayFeud.innerHTML = "<p>No feud questions found.</p>";
    }
  } catch (error) {
    console.error("Error fetching feud questions:", error);
    document.getElementById("questionsDisplayFeud").innerHTML =
      `<p>Error loading feud questions: ${error.message}</p>`;
  } finally {
    hideLoading();
  }
}

let currentFeudQuestionId = null;

// Event delegation for dynamic 'Select' buttons
document.getElementById("questionsDisplayFeud").addEventListener("click", (event) => {
  if (!event.target.classList.contains("select-feud-question")) return;

  event.preventDefault();

  const questionId = event.target.dataset.id;
  const questionDiv = event.target.closest("div[data-id]");
  if (!questionDiv) return;

  const questionText = questionDiv.querySelector("p")?.textContent.replace("Q:", "").trim() || "";

  const liItems = questionDiv.querySelectorAll("ul li");
  const answers = Array.from(liItems).map(li => li.textContent.split(" (")[0]);

  document.getElementById("feudId").value = questionId;
  document.getElementById("feudQuestionText").value = questionText;
  document.getElementById("answer1").value = answers[0] || "";
  document.getElementById("answer2").value = answers[1] || "";
  document.getElementById("answer3").value = answers[2] || "";
  document.getElementById("answer4").value = answers[3] || "";

  const alt = [...questionDiv.querySelectorAll("p")].find(p => p.textContent.includes("Alternate:"));
  const tags = [...questionDiv.querySelectorAll("p")].find(p => p.textContent.includes("Tags:"));

  document.getElementById("alternateAnswer").value = alt ? alt.textContent.replace("Alternate:", "").trim() : "";
  document.getElementById("feudTags").value = tags ? tags.textContent.replace("Tags:", "").trim() : "";

  currentFeudQuestionId = questionId;
  editFeudQuestionBtn.textContent = "Update Question";
});

// Update feud question
async function updateFeudQuestion() {
  const feudId = document.getElementById("feudId").value;
  const questionText = document.getElementById("feudQuestionText").value;
  const alternateAnswer = document.getElementById("alternateAnswer").value;
  const tags = document.getElementById("feudTags").value;

  const answers = [
    { text: document.getElementById("answer1").value, points: 40 },
    { text: document.getElementById("answer2").value, points: 30 },
    { text: document.getElementById("answer3").value, points: 20 },
    { text: document.getElementById("answer4").value, points: 10 }
  ].filter(a => a.text);

  try {
    const response = await fetch(`http://localhost:4001/update-feud-question/${feudId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feudId, questionText, answers, alternateAnswer, tags })
    });

    const result = await response.json();

    if (result.success) {
      alert("Feud question updated successfully!");
    } else {
      alert(`Failed to update question: ${result.error}`);
    }
  } catch (error) {
    console.error("Error updating question:", error);
    alert("Error updating question.");
  }
}


// Search standard questions or songs
searchQuestionsInput.addEventListener("input", async function () {
  const query = this.value.trim();
  const categoryId = document.getElementById("categoryQuestions").value;
  if (query) {
    showLoading();
    try {
      if (categoryId === "music-rounds") {
        const response = await fetch(
          `http://localhost:4001/songs?query=${encodeURIComponent(query)}`
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        console.log("Songs API Response:", data);

        if (data.success) {
          questionsDisplayQuestions.innerHTML = data.songs
            .map(
              (s) => `
                <div data-id="${s.song_id}">
                  <p><strong>Song:</strong> ${s.song_title} by ${s.artist_name}</p>
                  ${s.featuring ? `<p><strong>Featuring:</strong> ${s.featuring}</p>` : ""}
                  ${s.tags ? `<p><strong>Tags:</strong> ${s.tags}</p>` : ""}
                  <button class="select-song" data-id="${s.song_id}">Select</button>
                </div>`
            )
            .join("<hr>");
        } else {
          questionsDisplayQuestions.innerHTML = "<p>No matching songs found.</p>";
        }
      } else {
        const response = await fetch(
          `http://localhost:4001/questions?query=${encodeURIComponent(query)}`
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        console.log("Questions API Response:", data); // Debugging log

        if (data.success) {
          questionsDisplayQuestions.innerHTML = data.questions
            .map((q) => {
              let answersHtml = q.multiple_choice_only
                ? `<p><strong>Answers:</strong></p><ul>${q.answers
                    .map(
                      (a) =>
                        `<li>${a.answer_text} (${
                          a.is_correct ? "Correct" : "Incorrect"
                        })</li>`
                    )
                    .join("")}</ul>`
                : `<p><strong>Answer:</strong> ${q.correct_answer}</p>${
                    q.wrong_answer ? `<p><strong>Wrong:</strong> ${q.wrong_answer}</p>` : ""
                  }`;

                  return `
                  <table class="question-table" data-id="${q.question_id}" border="1" cellpadding="10" cellspacing="0" style="margin-bottom: 1rem; width: 100%; text-align: center;">
                    <thead style="background: linear-gradient(#2575fc);">
                      <tr>
                        <th>Question</th>
                        ${answersHtml ? `<th>Answers</th>` : ""}
                        ${q.tags ? `<th>Tags</th>` : ""}
                        ${q.first_name ? `<th>First Name</th>` : ""}
                        ${q.middle_name ? `<th>Middle Name</th>` : ""}
                        ${q.last_name ? `<th>Last Name</th>` : ""}
                        ${q.name ? `<th>Name</th>` : ""}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>${q.question_text}</td>
                        ${answersHtml ? `<td>${answersHtml}</td>` : ""}
                        ${q.tags ? `<td>${q.tags}</td>` : ""}
                        ${q.first_name ? `<td>${q.first_name}</td>` : ""}
                        ${q.middle_name ? `<td>${q.middle_name}</td>` : ""}
                        ${q.last_name ? `<td>${q.last_name}</td>` : ""}
                        ${q.name ? `<td>${q.name}</td>` : ""}
                      </tr>
                      <tr>
                        <td colspan="${[
                          'question_text',
                          answersHtml && 'answersHtml',
                          q.tags && 'tags',
                          q.first_name && 'first_name',
                          q.middle_name && 'middle_name',
                          q.last_name && 'last_name',
                          q.name && 'name'
                        ].filter(Boolean).length}" style="text-align: right; padding-top: 10px;">
                          <button class="select-question" data-id="${q.id}">Select</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                `;
                
            })
            .join("<hr>");
        } else {
          questionsDisplayQuestions.innerHTML = "<p>No matching questions found.</p>";
        }
      }
    } catch (error) {
      console.error("Error searching questions:", error);
      questionsDisplayQuestions.innerHTML =
        "<p>Error searching questions: " + error.message + "</p>";
    } finally {
      hideLoading();
    }
  } else {
    if (categoryId === "music-rounds") fetchSongs(categoryId);
    else fetchQuestions(categoryId);
  }
});

// Search feud questions
searchFeudQuestionsInput.addEventListener("input", async function () {
  const query = this.value.trim();
  const categoryId = document.getElementById("categoryFeud").value;

  if (query) {
    showLoading();
    try {
      const response = await fetch(
        `http://localhost:4001/feud-questions/search?query=${encodeURIComponent(query)}`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.success && Array.isArray(data.feudQuestions)) {
        questionsDisplayFeud.innerHTML = data.feudQuestions
        .map(q => {
          return `
            <div data-id="${q.question_id || q.id}" data-question='${JSON.stringify(q).replace(/'/g, "&apos;")}'>
              <p><strong>Q:</strong> ${q.question_text}</p>
              <p><strong>4 Point Answer:</strong> ${q.answer1}</p>
              <p><strong>3 Point Answer:</strong> ${q.answer2}</p>
              <p><strong>2 Point Answer:</strong> ${q.answer3}</p>
              <p><strong>1 Point Answer:</strong> ${q.answer4}</p>
              ${q.alternate_answer ? `<p><strong>Alternate:</strong> ${q.alternate_answer}</p>` : ""}
              ${q.tags ? `<p><strong>Tags:</strong> ${q.tags}</p>` : ""}
              <button type="button" class="select-feud-question" data-id="${q.question_id || q.id}">Select</button>
            </div>`;
        })
        .join("<hr>");      
      } else {
        questionsDisplayFeud.innerHTML = "<p>No matching feud questions found.</p>";
      }
    } catch (error) {
      console.error("Error searching feud questions:", error);
      questionsDisplayFeud.innerHTML =
        "<p>Error searching feud questions: " + error.message + "</p>";
    } finally {
      hideLoading();
    }
  } else {
    fetchFeudQuestions(categoryId);
  }
});

// Autofill feud input fields on select
questionsDisplayFeud.addEventListener("click", function (e) {
  if (e.target.classList.contains("select-feud-question")) {
    const dataQuestion = e.target.getAttribute("data-question");
    if (!dataQuestion) {
      console.error("Missing data-question attribute");
      return;
    }

    let parsed = {};
    try {
      parsed = JSON.parse(dataQuestion.replace(/&apos;/g, "'"));
    } catch (err) {
      console.error("Invalid JSON in data-question:", dataQuestion);
      return;
    }

    document.getElementById("feudQuestionText").value = parsed.question_text || "";
    document.getElementById("alternateAnswer").value = parsed.alternate_answer || "";
    document.getElementById("feudTags").value = parsed.tags || "";
    document.getElementById("answer1").value = parsed.answer1 || "";
    document.getElementById("answer2").value = parsed.answer2 || "";
    document.getElementById("answer3").value = parsed.answer3 || "";
    document.getElementById("answer4").value = parsed.answer4 || "";
    
    // Set ID for editing
    document.getElementById("feudId").value = e.target.getAttribute("data-id");

        // Change button text to "Update" after autofilling
        document.getElementById("editFeudQuestion").textContent = "Update";
  }
});


  // Select standard question or song
  questionsDisplayQuestions.addEventListener("click", function (e) {
    console.log("Click event detected:", e.target);
    
    if (e.target.classList.contains("select-question")) {
      const id = e.target.dataset.id;
      showLoading();
      fetch(`http://localhost:4001/questions?id=${id}`)
        .then(response => {
          console.log("Fetch response status:", response.status);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          console.log("Fetched question data:", data);

          if (data.success && data.questions.length > 0) {
            const q = data.questions[0];
            console.log("Populating form fields with question:", q);

            document.getElementById("categoryQuestions").value = q.category_id;
            document.getElementById("questionText").value = q.question_text;
            document.getElementById("tagsQuestions").value = q.tags || "";
            document.getElementById("multipleChoice").checked =
              q.multiple_choice_only === 1;

            if (q.multiple_choice_only) {
              document.getElementById("correctAnswer").value = "";
              document.getElementById("wrongAnswer").value = q.answers
                .filter(a => !a.is_correct)
                .map(a => a.answer_text)
                .join(", ");
            } else {
              document.getElementById("correctAnswer").value = q.correct_answer || "";
              document.getElementById("wrongAnswer").value = q.wrong_answer || "";
            }
            
          //Autofill first name, middle name, last name, and tags
              document.getElementById("firstNamePerson").value = q.first_name || "";
              document.getElementById("firstNameChar").value = q.first_name || "";
              document.getElementById("midNamePerson").value = q.middle_name || "";
              document.getElementById("midNameChar").value = q.middle_name || "";
              document.getElementById("lastNamePerson").value = q.last_name || "";
              document.getElementById("lastNameChar").value = q.last_name || "";
              document.getElementById("namePlace").value = q.name || "";
              document.getElementById("wrongAnswerrightSec").value = q.wrong_answer_right || "";
              document.getElementById("rightsecTags").value = q.tags_1 || "";


              currentQuestionId = q.id; // ✅ Ensure the correct ID is assigned
              console.log("✔️ Assigned Question ID:", currentQuestionId);

              document.getElementById("deletequestionId").value = currentQuestionId;
              
                       //Set image preview
          const imagePreview = document.getElementById("imagePreview");
          if (q.image_file) {
            imagePreview.innerHTML = `<img src="http://localhost:4001/${q.image_file}" style="max-width: 100%; height: auto; border-radius: 5px;">`;
          } else {
            imagePreview.innerHTML = "";
          }

            editQuestionBtn.textContent = "Update";
            deleteQuestionBtn.style.display = "inline-flex";
          }
        })
        .catch(error => console.error("Error fetching question:", error))
        .finally(() => hideLoading());
    } else if (e.target.classList.contains("select-song")) {
      const id = e.target.dataset.id;
      showLoading();
      fetch(`http://localhost:4001/songs?id=${id}`)
        .then(response => {
          console.log("Fetch response status:", response.status);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          console.log("Fetched song data:", data);

          if (data.success && data.songs.length > 0) {
            const s = data.songs[0];
            console.log("Populating form fields with song:", s);

            document.getElementById("artistName").value = s.artist_name;
            document.getElementById("songTitle").value = s.song_title;
            document.getElementById("featuring").value = s.featuring || "";
            document.getElementById("musicTags").value = s.tags || "";
            currentSongId = s.song_id;
            editSongBtn.textContent = "Update Song";
            deleteSongBtn.style.display = "inline-flex";
            wavesurfer.load(s.song_url);
          }
        })
        .catch(error => console.error("Error fetching song:", error))
        .finally(() => hideLoading());
    }
  });

// Function to delete a question by ID
document.getElementById("deleteQuestionQuestions").addEventListener("click", async function () {
  const selectedQuestionId = document.getElementById("deletequestionId")?.value;

  if (!selectedQuestionId) {
    alert("⚠️ No question selected for deletion!");
    console.error("❌ No valid question ID found in #deletequestionId!");
    return;
  }

  const confirmation = window.confirm("Are you sure you want to delete this question?");
  if (!confirmation) return;

  try {
    const response = await fetch(`http://localhost:4001/delete-question/${selectedQuestionId}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (data.success) {
      console.log("✅ Question deleted successfully!");

      // Clear form (you might want to clear the hidden input too)
      clearQuestionForm();

      // Reload or update UI
      window.location.reload();
    } else {
      console.error("❌ Error deleting question:", data.message);
      alert("❌ Failed to delete question: " + data.message);
    }
  } catch (error) {
    console.error("❌ Error deleting question:", error);
    alert("❌ An error occurred while deleting the question.");
  }
});

  // Select feud question
  questionsDisplayFeud.addEventListener("click", function (e) {
    if (e.target.classList.contains("select-feud-question")) {
      const container = e.target.closest("div[data-id]");
      if (!container) {
        console.error("Could not find parent container with data-id");
        return;
      }
  
      const dataQuestion = container.getAttribute("data-question");
      if (!dataQuestion) {
        console.error("Missing data-question attribute");
        return;
      }
  
      let parsed = {};
      try {
        parsed = JSON.parse(dataQuestion.replace(/&apos;/g, "'"));
      } catch (err) {
        console.error("Invalid JSON in data-question:", dataQuestion);
        return;
      }
  
      document.getElementById("feudQuestionText").value = parsed.question_text || "";
      document.getElementById("alternateAnswer").value = parsed.alternate_answer || "";
      document.getElementById("feudTags").value = parsed.tags || "";
      document.getElementById("answer1").value = parsed.answer1 || "";
      document.getElementById("answer2").value = parsed.answer2 || "";
      document.getElementById("answer3").value = parsed.answer3 || "";
      document.getElementById("answer4").value = parsed.answer4 || "";
    }
  });
  

// Edit standard question
editQuestionBtn.addEventListener("click", async function () {

  console.log("🖱️ Update button clicked!"); // ✅ Confirms button click
  if (!currentQuestionId) {
    console.error("❌ No Question ID found! Cannot update.");
    alert("⚠️ Error: No question selected for updating.");
    return;
  }
  
  console.log(`📤 Fetching: http://localhost:4001/update-question/${currentQuestionId}`);


  if (!currentQuestionId) return;

  const questionText = document.getElementById("questionText").value.trim();
  const correctAnswer = document.getElementById("correctAnswer").value.trim();
  const wrongAnswer = document.getElementById("wrongAnswer").value.trim() || null;
  const tagsQuestions = document.getElementById("tagsQuestions").value.trim() || null;
  const imageFile = document.getElementById("imageFile").value.trim() || null;
  const multipleChoice = document.getElementById("multipleChoice").checked;

  if (!questionText || !correctAnswer) {
    alert("Please enter a question and correct answer.");
    return;
  }

  const questionData = {
    questionText: questionText,
    correctAnswer: correctAnswer,
    wrongAnswer: wrongAnswer,
    imageFile: imageFile,
    tags: tagsQuestions,
    multiple_choice: multipleChoice  // ✅ Ensure correct field name
  };

  console.log("📦 Question Data Before Sending:", JSON.stringify(questionData, null, 2));

  showLoading();
  try {
    const response = await fetch(
      `http://localhost:4001/update-question/${currentQuestionId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(questionData)
      }
    );

    console.log("📤 Sent Update Request:", JSON.stringify(questionData, null, 2));
    console.log("Response Status:", response.status);

    const result = await response.json();
    console.log("✅ Server Response:", result);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (result.success) {
      alert("✅ Question updated successfully!");
      clearQuestionForm();
      currentQuestionId = null;
      editQuestionBtn.textContent = "Edit";
                  setTimeout(() => {
                    location.reload();
                  }, 1000);
    } else {
      alert("❌ Error updating question: " + result.error);
    }
  } catch (error) {
    console.error("🔥 Error updating question:", error);
    alert("⚠️ Failed to update question: " + error.message);
  } finally {
    hideLoading();
  }
});

  document.addEventListener("click", function (e) {
    if (e.target && e.target.id === "editQuestionQuestions") {
      console.log("Update button clicked!");
    }
  });

  // Edit music round (song)
  editSongBtn.addEventListener("click", async function () {
    console.log("🖱️ Edit Song button clicked!");
  
    if (!currentSongId) {
      console.error("❌ No Song ID found! Cannot update.");
      alert("⚠️ Error: No song selected for updating.");
      return;
    }
  
    const artistName = document.getElementById("artistName").value.trim();
    const songTitle = document.getElementById("songTitle").value.trim();
    const featuring = document.getElementById("featuring").value.trim();
    const musicTags = document.getElementById("musicTags").value.trim();
    const wrongName = document.getElementById("wrongName").value.trim();
    const wrongTitle = document.getElementById("wrongTitle").value.trim();
    const wrongAnswerMusic = document.getElementById("wrongAnswerMusic").value.trim();
  
    if (!artistName || !songTitle) {
      alert("Please enter both artist and song title.");
      return;
    }
  
    const songData = {
      artistName: artistName,
      songTitle: songTitle,
      featuring: featuring,
      musicTags: musicTags,
      wrongName: wrongName,
      wrongTitle: wrongTitle,
      wrongAnswerMusic: wrongAnswerMusic
    };
  
    console.log(`📤 PUT to: http://localhost:4001/update-song/${currentSongId}`);
    console.log("📦 Song Data Before Sending:", JSON.stringify(songData, null, 2));
  
    showLoading();
    try {
      const response = await fetch(`http://localhost:4001/update-song/${currentSongId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(songData)
      });
  
      console.log("Response Status:", response.status);
  
      const result = await response.json();
      console.log("✅ Server Response:", result);
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      if (result.success) {
        alert("✅ Song updated successfully!");
        clearMusicForm();
        currentSongId = null;
        editSongBtn.textContent = "Edit Song";
        setTimeout(() => {
          location.reload();
        }, 1000);
      } else {
        alert("❌ Error updating song: " + result.error);
      }
    } catch (error) {
      console.error("🔥 Error updating song:", error);
      alert("⚠️ Failed to update song: " + error.message);
    } finally {
      hideLoading();
    }
  });

  // Edit feud question
const editFeudBtn = document.getElementById("editFeudQuestion");

editFeudBtn.addEventListener("click", async function () {
  console.log("🖱️ Edit Feud button clicked!");

  const feudId = document.getElementById("feudId").value.trim(); // ✅ Now uses the hidden input

  if (!feudId) {
    console.error("❌ No Feud Question ID found! Cannot update.");
    alert("⚠️ Error: No feud question selected for updating.");
    return;
  }

  const category = document.getElementById("categoryFeud").value.trim();
  const questionText = document.getElementById("feudQuestionText").value.trim();
  const fourPoints = document.getElementById("answer1").value.trim();
  const threePoints = document.getElementById("answer2").value.trim();
  const twoPoints = document.getElementById("answer3").value.trim();
  const onePoint = document.getElementById("answer4").value.trim();
  const alternateAnswer = document.getElementById("alternateAnswer").value.trim();
  const tags = document.getElementById("feudTags").value.trim();

  // ✅ Validate all 4 answer fields are filled
  if (!fourPoints || !threePoints || !twoPoints || !onePoint) {
    alert("⚠️ Please make sure all four answer fields are filled.");
    return;
  }

  const feudData = {
    question_text: questionText, // ✔️ match backend
    question_type: category,
    answers: [
      { text: fourPoints },
      { text: threePoints },
      { text: twoPoints },
      { text: onePoint }
    ],
    alternate_answer: alternateAnswer, // ✔️ match backend
    tags
  };
  

  console.log(`📤 PUT to: http://localhost:4001/update-feud-question/${feudId}`);
  console.log("📦 Feud Data Before Sending:", JSON.stringify(feudData, null, 2));

  try {
    const response = await fetch(`http://localhost:4001/update-feud-question/${feudId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(feudData)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (result.success) {
      alert("✅ Feud question updated successfully!");
      document.getElementById("feudId").value = ""; // ✅ Reset feudId after update
      setTimeout(() => {
      window.location.reload();
    }, 1000);
    } else {
      alert("❌ Error updating feud question: " + result.error);
    }
  } catch (error) {
    console.error("🔥 Error updating feud question:", error);
    alert("⚠️ Failed to update feud question: " + error.message);
  }
});


  // Example usage when selecting a question from the list:
  function populateFeudForm(question) {
    console.log("➡️ Populating form with question ID:", question._id);
  
    // ✅ Set hidden field for feudId
    document.getElementById("feudId").value = question._id;
  
    document.getElementById("categoryFeud").value = question.category;
    document.getElementById("feudQuestionText").value = question.questionText;
    document.getElementById("answer1").value = question.answers.fourPoints || "";
    document.getElementById("answer2").value = question.answers.threePoints || "";
    document.getElementById("answer3").value = question.answers.twoPoints || "";
    document.getElementById("answer4").value = question.answers.onePoint || "";
    document.getElementById("alternateAnswer").value = question.alternateAnswer || "";
    document.getElementById("feudTags").value = question.tags || "";
  
    // UI cue
    document.getElementById("editFeudQuestion").textContent = "Update";
  }
  
  
  // Delete song (explicit)
  deleteSongBtn.addEventListener("click", async function () {
    if (!currentSongId || !confirm("Are you sure you want to delete this song?")) return;
    const categoryId = document.getElementById("categoryQuestions").value;
    showLoading();
    try {
      const response = await fetch(
        `http://localhost:4001/delete-song/${currentSongId}`,
        {
          method: "DELETE"
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        alert("Song deleted successfully!");
        clearMusicForm();
        fetchSongs(categoryId);
        currentSongId = null;
      } else {
        alert("Error deleting song: " + result.error);
      }
    } catch (error) {
      console.error("Error deleting song:", error);
      alert("Failed to delete song: " + error.message);
    } finally {
      hideLoading();
    }
  });

  // Delete image
  deleteImageBtn.addEventListener("click", async function () {
    if (!currentImageId || !confirm("Are you sure you want to delete this image?")) return;
    showLoading();
    try {
      const response = await fetch(
        `http://localhost:4001/delete-image/${currentImageId}`,
        {
          method: "DELETE"
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        alert("Image deleted successfully!");
        clearImageForm();
        fetchImages(document.getElementById("imageCategory").value);
        currentImageId = null;
      } else {
        alert("Error deleting image: " + result.error);
      }
    } catch (error) {
      console.error("Error deleting image:", error);
      alert("Failed to delete image: " + error.message);
    } finally {
      hideLoading();
    }
  });

// Delete image song 
document.addEventListener("click", async (e) => {
  const deleteImageSongBtn = e.target.closest(".delete-image-song");

  console.log("🟡 Click target:", e.target);
  console.log("🎯 Matched deleteImageSongBtn:", deleteImageSongBtn);
  console.log("🎯 Final Rendered HTML:", imageSearchResults.innerHTML);


  if (!deleteImageSongBtn) return;

  const imageId = deleteImageSongBtn.dataset.id;
  console.log("🧨 Delete button clicked. imageId:", imageId);

  if (!imageId) {
    alert("No image ID found to delete.");
    return;
  }

  if (!confirm("Are you sure you want to delete this image?")) return;

  try {
    const response = await fetch(`http://localhost:4001/delete-image-song/${imageId}`, {
      method: "DELETE",
    });

    const result = await response.json();
    if (result.success) {
      alert("✅ Image deleted successfully.");
      location.reload();
      selectedImageId = null;
      fetchImagesMusic();
    } else {
      alert("❌ Failed to delete image.");
    }
  } catch (error) {
    console.error("Error deleting image:", error);
    alert("Error deleting image.");
  }
});

  // Music file load
  // musicFile.addEventListener("change", async function () {
  //   const file = this.files[0];
  //   if (file && file.type.startsWith("audio/")) {
  //     const url = URL.createObjectURL(file);
  //     wavesurfer.load(url);
  //     showLoading();
  //     try {
  //       const arrayBuffer = await file.arrayBuffer();
  //       originalBuffer = await audioContext.decodeAudioData(arrayBuffer);
  //     } catch (error) {
  //       console.error("Error loading audio file:", error);
  //       alert("Failed to load audio file: " + error.message);
  //     } finally {
  //       hideLoading();
  //     }
  //   }
  // });

  // playPauseBtn.addEventListener("click", function () {
  //   if (wavesurfer) {
  //     if (wavesurfer.isPlaying()) {
  //       wavesurfer.pause();
  //       this.textContent = "Play";
  //     } else {
  //       wavesurfer.play();
  //       this.textContent = "Pause";
  //     }
  //   }
  // });  

  // stopBtn.addEventListener("click", function () {
  //   if (wavesurfer) {
  //     wavesurfer.stop();
  //     playPauseBtn.textContent = "Play";
  //   }
  // });

  // applyCropBtn.addEventListener("click", async function () {
  //   if (!originalBuffer) {
  //     alert("No audio loaded to crop!");
  //     return;
  //   }
  //   const startTime = parseFloat(cropStartInput.value) || 0;
  //   const endTime = parseFloat(cropEndInput.value) || 0;
  //   if (startTime >= endTime || endTime > originalBuffer.duration) {
  //     alert("Invalid start/end times.");
  //     return;
  //   }

  //   showLoading();
  //   try {
  //     const length = endTime - startTime;
  //     const sampleRate = originalBuffer.sampleRate;
  //     const newBuffer = audioContext.createBuffer(
  //       originalBuffer.numberOfChannels,
  //       length * sampleRate,
  //       sampleRate
  //     );

  //     for (let channel = 0; channel < originalBuffer.numberOfChannels; channel++) {
  //       const oldData = originalBuffer.getChannelData(channel);
  //       const newData = newBuffer.getChannelData(channel);
  //       const startSample = Math.floor(startTime * sampleRate);
  //       const endSample = Math.floor(endTime * sampleRate);
  //       for (let i = 0; i < endSample - startSample; i++) {
  //         newData[i] = oldData[startSample + i];
  //       }
  //     }

  //     croppedBuffer = newBuffer;
  //     originalBuffer = newBuffer;
  //     const blob = await audioBufferToWaveBlob(newBuffer);
  //     wavesurfer.loadBlob(blob);
  //     alert("Audio cropped successfully!");
  //   } catch (error) {
  //     console.error("Error cropping audio:", error);
  //     alert("Failed to crop audio: " + error.message);
  //   } finally {
  //     hideLoading();
  //   }
  // });

  // gainRange.addEventListener("input", function () {
  //   if (gainNode) {
  //     gainNode.gain.value = parseFloat(this.value);
  //   }
  // });

  // lowFilterRange.addEventListener("input", function () {
  //   if (filterNode) {
  //     filterNode.frequency.value = parseFloat(this.value);
  //   }
  // });

  //audio buffer

  function audioBufferToMp3Blob(audioBuffer) {
    const samples = audioBuffer.getChannelData(0); // mono
    const sampleRate = audioBuffer.sampleRate;
  
    const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, 128); // 1 channel (mono), 128kbps
    const sampleBlockSize = 1152;
    const mp3Data = [];
  
    let sampleIndex = 0;
    while (sampleIndex < samples.length) {
      const sampleChunk = samples.subarray(sampleIndex, sampleIndex + sampleBlockSize);
      const int16Samples = new Int16Array(sampleChunk.length);
      for (let i = 0; i < sampleChunk.length; i++) {
        int16Samples[i] = Math.max(-1, Math.min(1, sampleChunk[i])) * 32767;
      }
      const mp3buf = mp3encoder.encodeBuffer(int16Samples);
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
      sampleIndex += sampleBlockSize;
    }
  
    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
  
    return new Blob(mp3Data, { type: 'audio/mp3' });
  }
  
//Save/Export Song
saveBtn.addEventListener("click", function () {
  if (!decodedBuffer) {
    alert("No audio to save!");
    return;
  }

  showLoading();

  try {
    const finalBlob = audioBufferToMp3Blob(decodedBuffer);
    const url = URL.createObjectURL(finalBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "edited_audio.mp3";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    alert("MP3 saved successfully!");
  } catch (error) {
    console.error("Error saving MP3:", error);
    alert("Failed to save MP3: " + error.message);
  } finally {
    hideLoading();
  }
});

  
  // Function to convert AudioBuffer to WAV Blob (if you don't have this already)
  // async function audioBufferToWaveBlob(buffer) {
  //   const wavBuffer = bufferToWave(buffer, buffer.length);
  //   return new Blob([wavBuffer], { type: 'audio/wav' });
  // }

  // async function audioBufferToWaveBlob(buffer) {
  //   const numChannels = buffer.numberOfChannels;
  //   const length = buffer.length;
  //   const sampleRate = buffer.sampleRate;
  //   const totalDataLength = length * numChannels * 2;
  //   const headerSize = 44;
  //   const wavBuffer = new ArrayBuffer(headerSize + totalDataLength);
  //   const view = new DataView(wavBuffer);

  //   function writeString(offset, string) {
  //     for (let i = 0; i < string.length; i++) {
  //       view.setUint8(offset + i, string.charCodeAt(i));
  //     }
  //   }

  //   function floatTo16BitPCM(offset, input) {
  //     for (let i = 0; i < input.length; i++, offset += 2) {
  //       let s = Math.max(-1, Math.min(1, input[i]));
  //       s = s < 0 ? s * 32768 : s * 32767;
  //       view.setInt16(offset, s, true);
  //     }
  //   }

  //   writeString(0, 'RIFF');
  //   view.setUint32(4, 36 + totalDataLength, true);
  //   writeString(8, 'WAVE');
  //   writeString(12, 'fmt ');
  //   view.setUint32(16, 16, true);
  //   view.setUint16(20, 1, true);
  //   view.setUint16(22, numChannels, true);
  //   view.setUint32(24, sampleRate, true);
  //   view.setUint32(28, sampleRate * numChannels * 2, true);
  //   view.setUint16(32, numChannels * 2, true);
  //   // view.setUint16(34, 16, true);
  //   writeString(36, 'data');
  //   view.setUint32(40, totalDataLength, true);

  //   let offset = 44;
  //   for (let i = 0; i < length; i++) {
  //     for (let ch = 0; ch < numChannels; ch++) {
  //       floatTo16BitPCM(offset, buffer.getChannelData(ch).subarray(i, i + 1));
  //       offset += 2;
  //     }
  //   }

  //   return new Blob([wavBuffer], { type: 'audio/wav' });
  // }

// Drag & drop for image music rounds
imagePreviewMusic.addEventListener("drop", (e) => {
  e.preventDefault();
  imagePreviewMusic.style.borderColor = "#6a1b9a"; // Change border color on drop
  const file = e.dataTransfer.files[0];

  if (file && file.type.startsWith("image/")) {
    handleImageMusic(file);

    // ✅ Ensure cropper controls are visible
    const cropperControlsMusic = document.querySelector(".cropper-controlsMusic");
    if (cropperControlsMusic) {
      cropperControlsMusic.style.display = "flex";
    } else {
      console.error("❌ Cropper buttons not found!");
    }
  } else {
    alert("Please drop a valid image file.");
  }
});

// Handle file selection
if (imageFileMusic) {
  imageFileMusic.addEventListener("change", function () {
    const file = this.files[0];
    if (file && file.type.startsWith("image/")) {
      handleImageMusic(file);
    }
  });
}

// Function to handle the image
function handleImageMusic(file) {
  if (!file || !file.type.startsWith("image/")) {
    alert("Please select a valid image file.");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const imageSrc = e.target.result;

    imagePreviewMusic.innerHTML = `
      <div id="cropperContainerMusic" class="cropper-containerMusic">
        <img id="cropperImageMusic" class="cropper-imageMusic" src="${imageSrc}" />
      </div>`;

    // ✅ Show buttons when image is loaded
    document.querySelector(".cropper-controlsMusic").style.display = "flex";

    // ✅ Initialize Cropper
    if (musicCropper) musicCropper.destroy(); // Destroy any existing cropper instance
    musicCropper = new Cropper(document.getElementById("cropperImageMusic"), {
      aspectRatio: 1,
      viewMode: 1,        // Make sure the image is fully visible within the cropper area
      autoCropArea: 0.8,  // Limit the initial crop area
      scalable: true,
      zoomable: true,
      movable: true,
      responsive: true
    });
  };

  reader.readAsDataURL(file);
}

// Crop Image Button
cropImageBtnMusic.addEventListener("click", function () {
  if (musicCropper) {
    showLoading(); // Show loading indicator

    musicCropper
      .getCroppedCanvas({
        width: 300,
        height: 300,
        imageSmoothingQuality: "high"
      })
      .toBlob((blob) => {
        croppedMusicBlob = blob;
        imagePreviewMusic.innerHTML = `
          <img src="${URL.createObjectURL(blob)}" 
               style="max-width: 100%; height: auto; border-radius: 5px;">`;

        // Hide cropper container after cropping
        document.querySelector(".cropper-containerMusic").style.display = "none";

        // Fade out the buttons instead of hiding them completely
        document.querySelector(".cropper-controlsMusic").style.opacity = "0.7";

        hideLoading(); // Hide loading indicator
      }, "image/jpeg", 0.9);
  }
});

// Reset Crop Button
resetCropBtnMusic.addEventListener("click", function () {
  if (musicCropper) musicCropper.reset();
  
  // ✅ Show buttons again if reset
  document.querySelector(".cropper-controlsMusic").style.display = "flex";
});

//Drag and drop for image

// Drag & drop for image
imagePreview.addEventListener("drop", (e) => {
  e.preventDefault();
  imagePreview.style.borderColor = "#6a1b9a";
  const file = e.dataTransfer.files[0];

  if (file && file.type.startsWith("image/")) {
    handleImage(file);

    // ✅ Ensure buttons are visible
    const cropperControls = document.querySelector(".cropper-controls");
    if (cropperControls) {
      cropperControls.style.display = "flex";
    } else {
      console.error("❌ Cropper buttons not found!");
    }
  } else {
    alert("Please drop a valid image file.");
  }
});


// Handle file selection
fileInput.addEventListener("change", function () {
  const file = this.files[0];
  if (file && file.type.startsWith("image/")) {
    handleImage(file);
  }
});

function handleImage(file) {
  if (!file || !file.type.startsWith("image/")) {
    alert("Please select a valid image file.");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const imageSrc = e.target.result;

    imagePreview.innerHTML = `<div id="cropperContainer" class="cropper-container">
                                <img id="cropperImage" class="cropper-image" src="${imageSrc}" />
                              </div>`;

    // ✅ Show buttons when image is loaded
    document.querySelector(".cropper-controls").style.display = "flex";

    // ✅ Initialize Cropper
    cropper = new Cropper(document.getElementById("cropperImage"), {
      aspectRatio: 1,
      viewMode: 1,
      autoCropArea: 0.8,
      scalable: true,
      zoomable: true,
      movable: true,
      responsive: true
    });
  };

  reader.readAsDataURL(file);
}

// Crop Image Button
cropImageBtn.addEventListener("click", function () {
  if (cropper) {
    showLoading();
    cropper
      .getCroppedCanvas({
        width: 300,
        height: 300,
        imageSmoothingQuality: "high"
      })
      .toBlob((blob) => {
        croppedBlob = blob;
        imagePreview.innerHTML = `<img src="${URL.createObjectURL(
          blob
        )}" style="max-width: 100%; height: auto; border-radius: 5px;">`;

        cropperContainer.style.display = "none";

        // ❌ Instead of hiding the buttons, fade them out slightly
        document.querySelector(".cropper-controls").style.opacity = "0.7";

        hideLoading();
      }, "image/jpeg", 0.9);
  }
});

// Reset Crop Button
resetCropBtn.addEventListener("click", function () {
  if (cropper) cropper.reset();
  
  // ✅ Show buttons again
  document.querySelector(".cropper-controls").style.display = "flex";
});

uploadImageBtn.addEventListener("click", async function (e) {
  e.preventDefault();

  const imageCategory = document.getElementById("imageCategory").value;

  const firstName =
    imageCategory === "person"
      ? document.getElementById("firstNamePerson").value.trim()
      : imageCategory === "character"
      ? document.getElementById("firstNameChar").value.trim()
      : "";

  const midName =
    imageCategory === "person"
      ? document.getElementById("midNamePerson").value.trim()
      : imageCategory === "character"
      ? document.getElementById("midNameChar").value.trim()
      : "";

  const lastName =
    imageCategory === "person"
      ? document.getElementById("lastNamePerson").value.trim()
      : imageCategory === "character"
      ? document.getElementById("lastNameChar").value.trim()
      : "";

  const namePlace =
    imageCategory === "place" || imageCategory === "thing"
      ? document.getElementById("namePlace").value.trim()
      : "";

  const wrongAnswerrightSec = document.getElementById("wrongAnswerrightSec")?.value.trim() || "";
  const rightsecTags = document.getElementById("rightsecTags")?.value.trim() || "";
  const file = croppedBlob || fileInput.files[0];

  if (!file) {
    alert("Please select or drop an image to upload.");
    return;
  }

  const categorySelect = document.getElementById("categoryQuestions");
  const selectedCategorySlug = categorySelect?.value?.trim();

  if (!selectedCategorySlug) {
    alert("Missing category. Please select a category first.");
    return;
  }

  const questionText = document.getElementById("questionText")?.value.trim();
  const correctAnswer = document.getElementById("correctAnswer")?.value.trim();
  const wrongAnswer = document.getElementById("wrongAnswer")?.value.trim();
  const tagsQuestions = document.getElementById("tagsQuestions")?.value.trim() || "";

  if (!correctAnswer || !wrongAnswer) {
    alert("Please complete all question and answer fields.");
    return;
  }

const categorySlugToId = {
  "american-history": 1,
  "geography": 2,
  "sports": 3,
  "science-tech": 4,
  "who-am-i": 5,
  "name-that-song": 6,      // ✅ matches DB
  "arts-literature": 7,     // ✅ now correct
  "random": 8,
  "entertainment": 9,       // ✅ fixed
  "feud": 10,               // ✅ fixed
  "nature": 11,             // ✅ fixed
  "name-that-artist": 12,   // ✅ added
  "world-history": 13,      // ✅ fixed
  "wager-round": 14,
  "movies": 15
};

  
  const categoryId = categorySlugToId[selectedCategorySlug];
  if (!categoryId) {
    alert(`Invalid category selected: "${selectedCategorySlug}"`);
    return;
  }

  const checkboxes = ["sports", "entertainment", "other", "movie", "telev", "cart"];
  const formData = new FormData();

  formData.append("image", file, "image.jpg");
  formData.append("charperCategory", imageCategory);
  formData.append("firstName", firstName);
  formData.append("midName", midName);
  formData.append("lastName", lastName);
  formData.append("namePlace", namePlace);
  formData.append("wrongAnswerrightSec", wrongAnswerrightSec);
  formData.append("rightsecTags", rightsecTags);
  formData.append("categoryName", categoryId);
  formData.append("questionText", questionText);
  formData.append("correctAnswer", correctAnswer);
  formData.append("wrongAnswer", wrongAnswer);
  formData.append("tagsQuestions", tagsQuestions);

  checkboxes.forEach(id => {
    const checkbox = document.getElementById(id);
    formData.append(id, checkbox?.checked ? "1" : "0");
  });

  console.log("🟨 Uploading with data:", [...formData.entries()]);

  showLoading();
  try {
    const response = await fetch("http://localhost:4001/upload-image", {
      method: "POST",
      body: formData,
    });

    const newQuestion = await response.json();
    console.log("✅ New question received from server:", newQuestion);

    if (!newQuestion.id) {
      console.error("❌ Missing ID in response:", newQuestion);
      alert("Server error: question ID is missing.");
      return;
    }

// ✅ Push to frontend round with ID intact
if (window._currentRound && Array.isArray(window._currentRound.questions)) {
  console.log("🧪 New question to push:", newQuestion);

  if (!newQuestion.id) {
    console.error("❌ Server response is missing `id`:", newQuestion);
    alert("Upload succeeded but the question has no ID — cannot allow editing.");
    return;
  }

  window._currentRound.questions.push({
    id: newQuestion.id, // ✅ must include this!
    text: newQuestion.text,
    type: newQuestion.type || "text",
    options: newQuestion.options || [],
    correct_answer: newQuestion.correctAnswer || "",
    wrong_answer: newQuestion.wrongAnswer || "",
    tags: newQuestion.tags || ""
  });

  renderRoundsToTable(window._currentRound, window.selectedQuizId);
}

    alert("🎉 Image and question uploaded successfully!");
    clearImageForm();
    fetchImages(imageCategory);
    setTimeout(() => {
  window.location.reload();
}, 1000);
  } catch (error) {
    console.error("❌ JS Error uploading image:", error);
    alert("Failed to upload image: " + error.message);
  } finally {
    hideLoading();
  }
});

  function clearImageForm() {
    imageFormSection
      .querySelectorAll("input[type='text'], input[type='checkbox']")
      .forEach(input => {
        if (input.type === "checkbox") input.checked = false;
        else input.value = "";
      });
    imagePreview.innerHTML =
      "<strong class='image-preview-text'>Drag and drop an image here, or select image from database</strong>";
    cropperContainer.style.display = "none";
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    croppedBlob = null;
    fileInput.value = "";
    imageSearchResults.innerHTML = "";
    editImageBtn.textContent = "Edit";
    deleteImageBtn.style.display = "inline-flex";
  }

// Store fetched images globally
let imagesData = [];

// Fetch Images by category (with optional query support)
async function fetchImages(category, query = "") {
  if (!category || typeof category !== "string") {
    console.warn("⚠️ Invalid or missing category:", category);
    imageSearchResults.innerHTML = "<p>Please select a valid image category.</p>";
    return;
  }

  showLoading();

  try {
    // Build the API URL with optional query param
    const baseUrl = `http://localhost:4001/images`;
    const url = new URL(baseUrl);
    url.searchParams.append("category", category);
    if (query.trim()) {
      url.searchParams.append("query", query.trim());
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log("📦 Fetched image data:", data);

    if (data.success && Array.isArray(data.images)) {
      imagesData = data.images;

      if (imagesData.length > 0) {
        renderImages(imagesData);
      } else {
        imageSearchResults.innerHTML = "<p>No images found for this category.</p>";
      }
    } else {
      throw new Error(data.error || "Invalid response format.");
    }
  } catch (error) {
    console.error("❌ Error fetching images:", error);
    imageSearchResults.innerHTML = `<p>Error loading images: ${error.message}</p>`;
  } finally {
    hideLoading();
  }
}

// Function to render images
function renderImages(images) {
  imageSearchResults.innerHTML = images
    .map(img => {
      // ✅ Build the correct image path (fixes double "uploads/uploads")
      const imagePath = img.image_file.startsWith("uploads/")
        ? `http://localhost:4001/${img.image_file}`
        : `http://localhost:4001/uploads/${img.image_file}`;

      return `
        <table class="image-table" data-id="${img.image_id}" border="1" cellpadding="10" cellspacing="0" style="margin-bottom: 1rem; width: 100%; text-align: center;">
          <thead style="background: linear-gradient(#2575fc);">
            <tr>
              <th>Image</th>
              ${img.first_name ? `<th>First Name</th>` : ""}
              ${img.middle_name ? `<th>Middle Name</th>` : ""}
              ${img.last_name ? `<th>Last Name</th>` : ""}
              ${img.name ? `<th>Name</th>` : ""}
              ${img.wrong_answer_right ? `<th>Wrong Answers</th>` : ""}
              ${img.tags_1 ? `<th>Tags</th>` : ""}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="display: flex; align-items: center; gap: 10px; justify-content: center;">
                <img src="${imagePath}" width="100" style="border: 1px solid #ccc;" />
                <label><input type="checkbox" id="useImageFromDB"> Use Image from Database</label>
              </td>
              ${img.first_name ? `<td>${img.first_name}</td>` : ""}
              ${img.middle_name ? `<td>${img.middle_name}</td>` : ""}
              ${img.last_name ? `<td>${img.last_name}</td>` : ""}
              ${img.name ? `<td>${img.name}</td>` : ""}
              ${img.wrong_answer_right ? `<td>${img.wrong_answer_right}</td>` : ""}
              ${img.tags_1 ? `<td>${img.tags_1}</td>` : ""}
            </tr>
            <tr>
              <td colspan="${[
                'image_file',
                img.first_name && 'first_name',
                img.middle_name && 'middle_name',
                img.last_name && 'last_name',
                img.name && 'name',
                img.wrong_answer_right && 'wrong_answer_right',
                img.tags_1 && 'tags_1'
              ].filter(Boolean).length}" style="text-align: right; padding-top: 10px;">
                <button class="select-image" data-id="${img.image_id}">Select</button>
              </td>
            </tr>
          </tbody>
        </table>
      `;
    })
    .join("<hr>");
}

// Dynamic search functionality
document.getElementById("searchImages").addEventListener("input", function(e) {
  const query = e.target.value.toLowerCase();

  // Filter the images based on the search query
  const filteredImages = imagesData.filter(img => {
    return (
      (img.first_name && img.first_name.toLowerCase().includes(query)) ||
      (img.middle_name && img.middle_name.toLowerCase().includes(query)) ||
      (img.last_name && img.last_name.toLowerCase().includes(query)) ||
      (img.name && img.name.toLowerCase().includes(query)) ||
      (img.tags_1 && img.tags_1.toLowerCase().includes(query))
    );
  });

  // Render filtered images
  renderImages(filteredImages);
});

// Handle Image Selection
document.addEventListener("click", async function (event) {
  if (event.target.classList.contains("select-image")) {
      const imageId = parseInt(event.target.dataset.id, 10);
      console.log("🖼️ Image ID Clicked:", imageId);
      console.log("🔍 Searching in imagesData:", imagesData);

      const selectedImage = imagesData.find(img => img.image_id === imageId);

      if (selectedImage) {
          console.log("📸 Selected Image Data:", selectedImage);

          // Get correct input elements
          const firstNameInput = document.getElementById("firstNamePerson");
          const midNameInput = document.getElementById("midNamePerson");
          const lastNameInput = document.getElementById("lastNamePerson");
          const firstNameChar = document.getElementById("firstNameChar");
          const midNameChar = document.getElementById("midNameChar");
          const lastNameChar = document.getElementById("lastNameChar");
          const namePlace = document.getElementById("namePlace");
          const wrongAnswerrightSec = document.getElementById("wrongAnswerrightSec");
          const rightsecTags = document.getElementById("rightsecTags");
          const imagePreview = document.getElementById("imagePreview");
          const selectedImageId = document.getElementById("selectedImageId");
          const editImageBtn = document.getElementById("editImage"); // 

          console.log("📌 firstName input exists?", firstNameInput);
          console.log("📌 midName input exists?", midNameInput);
          console.log("📌 lastName input exists?", lastNameInput);
          console.log("📌 firstNameChar input exists?", firstNameChar);
          console.log("📌 midNameChar input exists?", midNameChar);
          console.log("📌 lastNameChar input exists?", lastNameChar);
          console.log("📌 Name input exists?", namePlace);
          console.log("📌 Answer input exists?", wrongAnswerrightSec);
          console.log("📌 tags input exists?", rightsecTags);
          console.log("📌 imagePreview exists?", imagePreview);
          console.log("📌 selectedImageId exists?", selectedImageId);

          // Assign values only if the inputs exist
          if (firstNameInput) firstNameInput.value = selectedImage.first_name || "";
          if (midNameInput) midNameInput.value = selectedImage.middle_name || "";
          if (lastNameInput) lastNameInput.value = selectedImage.last_name || "";
          if (firstNameChar) firstNameChar.value = selectedImage.first_name || "";
          if (midNameChar) midNameChar.value = selectedImage.middle_name || "";
          if (lastNameChar) lastNameChar.value = selectedImage.last_name || "";
          if (namePlace) namePlace.value = selectedImage.name || "";
          if (wrongAnswerrightSec) wrongAnswerrightSec.value = selectedImage.wrong_answer_right || "";
          if (rightsecTags) rightsecTags.value = selectedImage.tags_1 || "";

        // Update the image preview if it exists
          if (imagePreview) {
          const imgUrl = `http://localhost:4001/${selectedImage.image_file.startsWith('uploads/') ? selectedImage.image_file : 'uploads/' + selectedImage.image_file}`;
            imagePreview.innerHTML = `
              <img src="${imgUrl}" style="max-width: 100%; height: auto; border-radius: 5px;" />
            `;

            try {
              const response = await fetch(imgUrl);
              if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
              const blob = await response.blob();
              croppedBlob = blob;
            } catch (err) {
              console.error("❌ Error loading blob from selected image:", err);
            }
          }

                    // Store the selected image ID if the field exists
                    if (selectedImageId) selectedImageId.value = selectedImage.image_id;

                    if (editImageBtn) editImageBtn.textContent = "Update"; 

                    console.log("✅ Inputs updated successfully!");
                } else {
                    console.error("🚨 No image found for ID:", imageId);
                }
            }
});

// Auto-fill the form fields when a Select button is clicked

  editImageBtn.addEventListener("click", async function () {
    if (!currentImageId) return;
    const imageCategory = document.getElementById("imageCategory").value;
    const firstName =
      imageCategory === "person"
        ? document.getElementById("firstNamePerson").value.trim()
        : imageCategory === "character"
        ? document.getElementById("firstNameChar").value.trim()
        : document.getElementById("firstName").value.trim();
    const midName =
      imageCategory === "person" || imageCategory === "character"
        ? document.getElementById("midName").value.trim()
        : "";
    const lastName =
      imageCategory === "person" || imageCategory === "character"
        ? document.getElementById("lastName").value.trim()
        : "";
    const rightsectags = document.getElementById("rightsecTags").value.trim();

    if (!firstName) {
      alert("Please enter a name for the image.");
      return;
    }

    const imageData = {
      category: imageCategory,
      firstName,
      middleName: midName,
      lastName,
      rightsectags
    };

    if (imageCategory === "person") {
      imageData.sports = document.getElementById("sports").checked ? 1 : 0;
      imageData.entertainment = document.getElementById("entertainment").checked ? 1 : 0;
      imageData.other = document.getElementById("others").checked ? 1 : 0;
    } else if (imageCategory === "character") {
      imageData.movie = document.getElementById("movie").checked ? 1 : 0;
      imageData.tv = document.getElementById("telev").checked ? 1 : 0;
      imageData.cartoon = document.getElementById("cart").checked ? 1 : 0;
    }

    showLoading();
    try {
      const response = await fetch(`http://localhost:4001/update-image/${currentImageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(imageData)
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        alert("Image updated successfully!");
        clearImageForm();
        fetchImages(imageCategory);
        currentImageId = null;
        editImageBtn.textContent = "Edit";
      } else {
        alert("Error updating image: " + result.error);
      }
    } catch (error) {
      console.error("Error updating image:", error);
      alert("Failed to update image: " + error.message);
    } finally {
      hideLoading();
    }
  });

  const categorySelect = document.getElementById("imageCategory");
  const catNameElements = document.querySelectorAll(".catName");
  const nameFieldElements = document.querySelectorAll(".name-field");
  const personFieldsContainers = document.querySelectorAll(".qi-person-fields");
  const characterCheckboxes = document.querySelectorAll(".check-new");
  const characterFieldsContainer = document.querySelector(".charFields");

  function toggleFields(elements, show) {
    elements.forEach(field => {
      if (show) field.classList.remove("qi-hidden");
      else field.classList.add("qi-hidden");
    });
  }

  function handleCategoryChange(value) {
    if (value === "character" || value === "person") {
      toggleFields(catNameElements, false);
      toggleFields(nameFieldElements, false);
    } else {
      toggleFields(catNameElements, true);
      toggleFields(nameFieldElements, true);
    }

    if (value === "character") {
      toggleFields(personFieldsContainers, false);
      toggleFields(characterCheckboxes, true);
      if (characterFieldsContainer) characterFieldsContainer.classList.remove("qi-hidden");
    } else if (value === "person") {
      toggleFields(personFieldsContainers, true);
      toggleFields(characterCheckboxes, false);
      if (characterFieldsContainer) characterFieldsContainer.classList.add("qi-hidden");
    } else {
      toggleFields(personFieldsContainers, false);
      toggleFields(characterCheckboxes, false);
      if (characterFieldsContainer) characterFieldsContainer.classList.add("qi-hidden");
    }
    fetchImages(value);
  }

  // Default to 'character' initially
  categorySelect.value = "character";
  handleCategoryChange("character");

  categorySelect.addEventListener("change", function () {
    handleCategoryChange(this.value);
  });
});

// Feud Section's Function
// document.addEventListener("DOMContentLoaded", function () {
//   const categorySelects = document.querySelectorAll("#category");
//   const feudSection = document.getElementById("feud-input");
//   const questionsSec = document.getElementById("quest-section");
//   const questionsInput = document.getElementById("questions-input");

//   categorySelects.forEach(select => {
//       select.addEventListener("change", function () {
//           const selectedValue = this.value;

//           // Update all category dropdowns to match the selected value
//           categorySelects.forEach(el => el.value = selectedValue);

//           if (selectedValue === "feud") {
//               feudSection.style.display = "block";
//               feudSection.scrollIntoView({ behavior: "smooth" });
//               questionsSec.style.display = "none";
//               questionsInput.style.display = "none";
//           } else {
//               feudSection.style.display = "none";
//               questionsSec.style.display = "block";
//               questionsInput.style.display = "block";
//           }
//       });
//   });
// });

document.getElementById("subImgOnly").addEventListener("click", async function(event) {
  event.preventDefault();
  console.log("✅ Submit Image Only button clicked!");

  const imageInput = document.getElementById("imageFile");
  if (!imageInput || !imageInput.files.length) {
      console.error("❌ No image selected!");
      alert("Please select an image before submitting.");
      return;
  }

  console.log("✅ Image selected:", imageInput.files[0]);

  const formData = new FormData();
  formData.append("image", imageInput.files[0]);

  try {
      console.log("🚀 Sending image to http://localhost:4001/upload-only-image...");
      
      const response = await fetch("http://localhost:4001/upload-only-image", {
          method: "POST",  // ✅ Ensure the request is a POST
          body: formData
      });

      console.log("✅ Response received:", response);

      const text = await response.text();
      if (!text.trim()) {
          throw new Error("❌ Server returned an empty response.");
      }

      const data = JSON.parse(text); // ✅ Safely parse JSON

      if (response.ok) {
          console.log("✅ Success:", data);
          alert("Image uploaded successfully!");
          imageInput.value = ""; // Reset input
      } else {
          console.error("❌ Error:", data);
          alert("Image upload failed: " + (data.error || "Unknown error"));
      }
  } catch (error) {
      console.error("❌ Fetch error:", error);
      alert("Network error while uploading image.");
  }
});

//Submit Image Only | Music Rounds Section
document.getElementById("subMusic").addEventListener("click", async function(event) {
  event.preventDefault();
  console.log("✅ Submit Image Only (Music) button clicked!");

  const imageInput = document.getElementById("imageFileMusic");
  if (!imageInput || !imageInput.files.length) {
    console.error("❌ No image selected!");
    alert("❌ Please select an image before submitting.");
    return;
  }

  const selectedImage = imageInput.files[0];
  console.log("✅ Image selected:", selectedImage.name);

  // Validate image type
  if (!selectedImage.type.startsWith("image/")) {
    alert("❌ Invalid file type. Please upload an image.");
    return;
  }

  const formData = new FormData();
  formData.append("image", selectedImage);

  try {
    const url = "http://localhost:4001/upload-only-image-music";
    console.log("🚀 Sending image to:", url);

    const response = await fetch(url, {
      method: "POST",
      body: formData
    });

    const data = await response.json();
    console.log("📩 Server Response:", data);

    if (response.ok && data.success) {
      alert("✅ Image uploaded successfully to Music table!");
      imageInput.value = ""; // Reset input
    } else {
      console.error("❌ Upload failed:", data);
      alert("❌ Upload failed: " + (data.error || "Unknown error"));
    }
  } catch (error) {
    console.error("🔥 Fetch error:", error);
    alert("❌ Network error while uploading image.");
  }
});

// 🎵 Music Rounds - Upload Music Question
document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("subSong").addEventListener("click", async function (event) {
    event.preventDefault();

    console.log("🎵 subSong button clicked");

    // ✅ Get input values & trim them
    let artistName = document.getElementById("artistName")?.value.trim() || "";
    let songTitle = document.getElementById("songTitle")?.value.trim() || "";
    let wrongName = document.getElementById("wrongName")?.value.trim() || "";
    let wrongTitle = document.getElementById("wrongTitle")?.value.trim() || "";
    let wrongAnswerMusic = document.getElementById("wrongAnswerMusic")?.value.trim() || "";
    let featuring = document.getElementById("featuring")?.value.trim() || "";
    let musicTags = document.getElementById("musicTags")?.value.trim() || "";
    let musicFile = document.getElementById("musicFile");
    let imageFileMusic = document.getElementById("imageFileMusic");
    let bandName = document.getElementById("bandName")?.value.trim() || "";
    let songField = document.getElementById("songField")?.value.trim() || "";
    let rightsecTagsMusic = document.getElementById("rightsecTagsMusic")?.value.trim() || "";
    let selectedCategory = document.getElementById("songCategory")?.value || "";
    let roundType = 6; // default

    if (selectedCategory === "name-that-artist-or-band") {
      roundType = 12;
    }

    // 🚨 Validate music file
    if (!musicFile || musicFile.files.length === 0) {
      alert("❌ Please select a music file to upload!");
      return;
    }

    let selectedMusicFile = musicFile.files[0];

    if (!selectedMusicFile.type.startsWith("audio/")) {
      alert("❌ Please upload a valid audio file!");
      return;
    }

    if (selectedMusicFile.size > 20 * 1024 * 1024) {
      alert("❌ Music file size exceeds 20MB limit!");
      return;
    }

    // ✅ Validate image file
    let selectedImageFile = imageFileMusic?.files?.[0] || null;
    if (!selectedImageFile) {
      alert("❌ Please select an image file to upload!");
      return;
    }

    if (!selectedImageFile.type.startsWith("image/")) {
      alert("❌ Please upload a valid image file!");
      return;
    }

    // 📌 Create FormData
    let formData = new FormData();
    formData.append("artistName", artistName);
    formData.append("songTitle", songTitle);
    formData.append("wrongName", wrongName);
    formData.append("wrongTitle", wrongTitle);
    formData.append("wrongAnswerMusic", wrongAnswerMusic);
    formData.append("featuring", featuring);
    formData.append("musicTags", musicTags);
    formData.append("musicFile", selectedMusicFile);
    formData.append("bandName", bandName);
    formData.append("songField", songField);
    formData.append("rightsecTagsMusic", rightsecTagsMusic);
    formData.append("imageFileMusic", selectedImageFile);
    formData.append("round_type", roundType.toString());
    formData.append("category", selectedCategory);

    // 📦 Debug FormData
    console.log("📦 FormData Entries (before sending):");
    for (let pair of formData.entries()) {
      console.log(`➡ ${pair[0]}:`, pair[1] instanceof File ? `File: ${pair[1].name}` : pair[1]);
    }

    try {
      const url = "http://localhost:4001/upload_song";
      console.log("🚀 Sending request to:", url);

      let response = await fetch(url, {
        method: "POST",
        body: formData,
        headers: {
          "Accept": "application/json",
        },
      });

      let contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        let text = await response.text();
        throw new Error("Server returned non-JSON response: " + text);
      }

      let data = await response.json();
      console.log("📩 Server Response:", data);

      if (data.success) {
        alert("✅ Music question saved successfully!");
        setTimeout(() => {
        window.location.reload();
      }, 1000);
      } else {
        alert("❌ Error: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("🔥 Fetch Error:", error);
      alert(`❌ Error connecting to the server!\n\nDetails: ${error.message}`);
    }
  });
});

//Update Image section
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".editImage").forEach(button => {
    button.addEventListener("click", async function (event) {
      event.preventDefault();

      let imageId = document.getElementById("selectedImageId")?.value.trim() || this.getAttribute("data-id");
      if (!imageId) {
        console.error("⚠️ No valid image ID found!");
        alert("❌ No valid image ID found!");
        return;
      }
      
      let wrongAnswerrightSec = document.getElementById("wrongAnswerrightSec")?.value.trim() || null;
      let rightsecTags = document.getElementById("rightsecTags")?.value.trim() || null;

      console.log("🆔 Selected Image ID:", imageId);
      console.log("❓ Wrong Answer Right:", wrongAnswerrightSec);
      console.log("🏷️ Tags:", rightsecTags);

      let updateData = {};
      if (wrongAnswerrightSec) updateData.wrong_answer_right = wrongAnswerrightSec;
      if (rightsecTags) updateData.tags_1 = rightsecTags;

      if (Object.keys(updateData).length === 0) {
        alert("❌ No changes detected. Please modify at least one field.");
        return;
      }

      console.log("📦 Final Payload:", JSON.stringify(updateData, null, 2));

      try {
        const url = `http://localhost:4001/update-image/${imageId}`;
        console.log("🚀 Sending request to:", url);

        let response = await fetch(url, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(updateData),
        });

        let textResponse = await response.text();
        console.log("📩 Raw Server Response:", textResponse);

        let data;
        try {
          data = JSON.parse(textResponse);
        } catch (error) {
          console.error("⚠️ JSON Parse Error:", error);
          alert("❌ Error: Server returned invalid JSON response.");
          return;
        }

        console.log("📩 Parsed Response:", data);

        if (data.success === true) {
          alert("✅ Image updated successfully!");

            // 🔄 Reload the page after a short delay (optional)
          setTimeout(() => {
            location.reload();
          }, 1000); // 1-second delay for better user experience

        } else {
          alert("❌ Error: " + (data.error || "Unknown error"));
        }
      } catch (error) {
        console.error("🔥 Fetch Error:", error);
        alert(`❌ Error connecting to the server!\n\nDetails: ${error.message}`);
      }
    });
  });
});

//Delete Image
document.getElementById("deleteImage").addEventListener("click", async function () {
  const selectedImageId = document.getElementById("selectedImageId")?.value; // ✅ Use the correct field

  if (!selectedImageId) {
      alert("⚠️ No image selected for deletion!");
      console.error("❌ No valid image ID found!");
      return;
  }

  // Ask for confirmation before proceeding with the deletion
  const confirmation = window.confirm("Are you sure you want to delete this image?");
  if (!confirmation) {
      return; // Abort the deletion if the user cancels
  }

  try {
      const response = await fetch(`http://localhost:4001/delete-image/${selectedImageId}`, {
          method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
          console.log("✅ Image deleted successfully!");

          // Clear the selected image preview and input
          document.getElementById("imagePreview").innerHTML = "";
          document.getElementById("selectedImageId").value = "";

          // Reload the page to reflect the changes
          window.location.reload();
      } else {
          console.error("❌ Error deleting image:", data.message);
      }
  } catch (error) {
      console.error("❌ Error deleting image:", error);
  }
});

// Clear form fields
document.addEventListener("DOMContentLoaded", function () {
  const clearImageFormBtn = document.getElementById("clearImageForm");

  clearImageFormBtn.addEventListener("click", function () {
    clearImageFields();
    // location.reload();
  });

  function clearImageFields() {
    const firstNameField = document.getElementById("firstNameChar");
    const midNameField = document.getElementById("midNameChar");
    const lastNameField = document.getElementById("lastNameChar");
    const firstNamePersonField = document.getElementById("firstNamePerson");
    const midNamePersonField = document.getElementById("midNamePerson");
    const lastNamePersonField = document.getElementById("lastNamePerson");
    const namePlaceField = document.getElementById("namePlace");
    const wrongAnswerrightSecField = document.getElementById("wrongAnswerrightSec");
    const rightsecTagsField = document.getElementById("rightsecTags");
    const imageFileField = document.getElementById("imageFile");
    const bandName = document.getElementById("band_name");
    const songField = document.getElementById("songField");
    const rightsecTagsMusic = document.getElementById("rightsecTagsMusic");

    console.log(firstNameField, midNameField, lastNameField, firstNamePersonField, midNamePersonField, lastNamePersonField, namePlaceField, imageFileField, wrongAnswerrightSecField, bandName, songField, rightsecTagsMusic, imageFileField);

    if (firstNameField) firstNameField.value = "";
    if (midNameField) midNameField.value = "";
    if (lastNameField) lastNameField.value = "";
    if (firstNamePersonField) firstNamePersonField.value = "";
    if (midNamePersonField) midNamePersonField.value = "";
    if (lastNamePersonField) lastNamePersonField.value = "";
    if (namePlaceField) namePlaceField.value = "";
    if (wrongAnswerrightSecField) wrongAnswerrightSecField.value = "";
    if (rightsecTagsField) rightsecTagsField.value = "";
    if (bandName) bandName.value = "";
    if (songField) songField.value = "";
    if (rightsecTagsMusic) rightsecTagsMusic.value = "";

    if (imageFileField) imageFileField.value = ""; 

    const imagePreview = document.getElementById("imagePreview");
    if (imagePreview) imagePreview.innerHTML = ""; 
    
    console.log("✅ Form fields cleared.");
  }
});

document.addEventListener("DOMContentLoaded", function () {
  const clearImageFormMusic = document.getElementById("clearImageFormMusic");

  clearImageFormMusic.addEventListener("click", function () {
    clearImageFieldsMusic();
    // location.reload();
  });

  function clearImageFieldsMusic() {
    const imageFileMusic = document.getElementById("imageFileMusic");
    const bandName = document.getElementById("bandName");
    const songField = document.getElementById("songField");
    const rightsecTagsMusic = document.getElementById("rightsecTagsMusic");

    console.log(bandName, songField, rightsecTagsMusic, imageFileMusic);

    if (imageFileMusic) imageFileMusic.value = "";
    if (bandName) bandName.value = "";
    if (songField) songField.value = "";
    if (rightsecTagsMusic) rightsecTagsMusic.value = "";
    if (imageFileMusic) imageFileMusic.value = ""; 

    const imagePreview = document.getElementById("imagePreview");
    if (imagePreview) imagePreview.innerHTML = ""; 
    
    console.log("✅ Form fields cleared.");
  }
});

// Search for images_music based on the query
// Search for images_music based on the query
// Function to show loading indicator
function showLoading() {
  const loadingIndicator = document.getElementById("loadingIndicator");
  if (loadingIndicator) {
    loadingIndicator.style.display = "block"; // Show the loading indicator
  }
}

// Function to hide loading indicator
function hideLoading() {
  const loadingIndicator = document.getElementById("loadingIndicator");
  if (loadingIndicator) {
    loadingIndicator.style.display = "none"; // Hide the loading indicator
  }
}

// Search for images_music based on the query

let selectedImageId = null; // Store the selected image ID globally

document.addEventListener("click", (e) => {
  const selectBtn = e.target.closest(".select-song");
  if (!selectBtn) return;

  const songDataRaw = selectBtn.dataset.song;
  if (!songDataRaw) {
    console.warn("No song data found on the button.");
    return;
  }

  try {
    const songData = JSON.parse(songDataRaw.replace(/&apos;/g, "'"));

    // Save the selected image ID
    selectedImageId = songData.id;

    // Attach it to the delete button
    const deleteBtn = document.getElementById("deleteImageSong");
    if (deleteBtn) {
      deleteBtn.dataset.id = selectedImageId;
      console.log("🆗 Selected image ID set for deletion:", selectedImageId);
    }
  } catch (err) {
    console.error("❌ Failed to parse song data:", err);
  }
});

async function fetchImagesMusic() {
  try {
    const response = await fetch("http://localhost:4001/images_music");
    const data = await response.json();

    if (data.success) {
      imageSearchResults.innerHTML = data.imagesMusic.map((s) => `
        <!-- Repeat the same HTML generation code from your search logic here -->
      `).join("<hr>");
    } else {
      imageSearchResults.innerHTML = "<p>No images found.</p>";
    }
  } catch (error) {
    console.error("Error fetching images_music:", error);
    imageSearchResults.innerHTML = `<p>Error fetching images: ${error.message}</p>`;
  }
}

const searchImagesMusic = document.getElementById('searchImagesMusic');
const imageSearchResults = document.querySelector('.qi-search-results.musicSearchRight'); // Use class selector

searchImagesMusic.addEventListener("input", async function () {
  const query = this.value.trim();

  if (query) {
    showLoading(); // Show loading indicator while fetching the data
    try {
      const response = await fetch(
        `http://localhost:4001/images_music/search?query=${encodeURIComponent(query)}`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Images Music API Response:", data);

  if (data.success) {
      imageSearchResults.innerHTML = data.imagesMusic
        .map((s) => `
          <table class="song-table" data-id="${s.id}" border="1" cellpadding="10" cellspacing="0" style="margin-bottom: 1rem; width: 100%; text-align: center;">
            <thead style="background: linear-gradient(#2575fc);">
              <tr>
                <th>Song</th>
                ${s.band_name ? `<th>Band</th>` : ""}
                ${s.music_tags_right ? `<th>Tags</th>` : ""}
                ${s.image_file ? `<th>Image</th>` : ""}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${s.song_title_right || "—"} by ${s.band_name || "—"}</td>
                ${s.band_name ? `<td>${s.band_name}</td>` : ""}
                ${s.music_tags_right ? `<td>${s.music_tags_right}</td>` : ""}
                ${s.image_file ? `<td><img src="/uploads/${s.image_file}" alt="Song Image" style="max-width: 150px;" /></td>` : ""}
              </tr>
              <tr>
                <td colspan="${[
                  'song_title_right',
                  s.band_name && 'band_name',
                  s.music_tags_right && 'music_tags_right',
                  s.image_file && 'image_file'
                ].filter(Boolean).length}" style="text-align: right; padding-top: 10px;">
                  <button class="select-song" data-song='${JSON.stringify(s).replace(/'/g, "&apos;")}'>Select</button>
                </td>
              </tr>
            </tbody>
          </table>
        `)
          .join("<hr>");
      } else {
        imageSearchResults.innerHTML = "<p>No matching images found.</p>";
      }
    } catch (error) {
      console.error("Error searching images_music:", error);
      imageSearchResults.innerHTML = `<p>Error searching images: ${error.message}</p>`;
    } finally {
      hideLoading(); // Hide the loading indicator
    }
  } else {
    // If no query is entered, reset the display or fetch all images
    fetchImagesMusic();
  }
});


// Edit Image Music button click handler
let currentImageId = null; // Store selected ID globally

// Delegate the "Select" button click from search results
document.addEventListener("click", function (e) {
  if (e.target && e.target.classList.contains("select-song")) {
    const songDataRaw = e.target.getAttribute("data-song");
    const songData = JSON.parse(songDataRaw.replace(/&apos;/g, "'"));

    // Save ID for update
    currentImageId = songData.id;
    console.log("🎯 Selected Image Music ID:", currentImageId);

    // Pre-fill the form with existing data
    document.getElementById("bandName").value = songData.band_name || "";
    document.getElementById("songField").value = songData.song_title_right || "";
    document.getElementById("rightsecTagsMusic").value = songData.music_tags_right || "";

    // Optional UI feedback
    editImageSong.textContent = "Update";
  }
});

// Function to clear the form after a successful update
const clearImageMusicForm = () => {
  document.getElementById("bandName").value = "";
  document.getElementById("songField").value = "";
  document.getElementById("rightsecTagsMusic").value = "";
};

// Edit Image Music button click handler
editImageSong.addEventListener("click", async function () {
  console.log("🖱️ Edit Image Music button clicked!");
  console.log("📂 Current Image ID:", currentImageId);

  if (!currentImageId) {
    console.error("❌ No Image Music ID found! Cannot update.");
    alert("⚠️ Error: No image music selected for updating.");
    return;
  }

  const bandName = document.getElementById("bandName").value.trim();
  const songField = document.getElementById("songField").value.trim();
  const rightsecTagsMusic = document.getElementById("rightsecTagsMusic").value.trim();

  if (!bandName || !songField || !rightsecTagsMusic) {
    alert("⚠️ Please fill in all fields.");
    return;
  }

  const imageMusicData = {
    band_name: bandName,
    song_title_right: songField,
    music_tags_right: rightsecTagsMusic
  };

  console.log(`📤 PUT to: http://localhost:4001/update-image-music/${currentImageId}`);
  console.log("📦 Image Music Data Before Sending:", JSON.stringify(imageMusicData, null, 2));

  showLoading();
  try {
    const response = await fetch(`http://localhost:4001/update-image-music/${currentImageId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(imageMusicData)
    });

    const result = await response.json();
    console.log("✅ Server Response:", result);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (result.success) {
      alert("✅ Image Music updated successfully!");
      clearImageMusicForm(); // Clear the form
      currentImageId = null;
      editImageSong.textContent = "Update";

      setTimeout(() => {
        location.reload();
      }, 1000);
    } else {
      alert("❌ Error updating image music: " + result.error);
    }
  } catch (error) {
    console.error("🔥 Error updating image music:", error);
    alert("⚠️ Failed to update image music: " + error.message);
  } finally {
    hideLoading();
  }
});

const fileInput = document.getElementById("musicFile");
const playPauseBtn = document.getElementById("playPauseBtn");
const stopBtn = document.getElementById("stopBtn");
const canvas = document.getElementById("waveCanvas");
const ctx = canvas.getContext("2d");

const audioPlayer = new Audio();
let isPlaying = false;
let decodedBuffer = null; // Store decoded audio buffer globally

fileInput.addEventListener("change", function () {
  const file = this.files[0];
  if (file) {
    const objectURL = URL.createObjectURL(file);
    audioPlayer.src = objectURL;
    isPlaying = false;
    playPauseBtn.textContent = "Play";

    // Draw waveform and store decoded buffer
    drawWaveform(file);
  }
});

playPauseBtn.addEventListener("click", function () {
  if (!audioPlayer.src) {
    alert("Please upload a song first.");
    return;
  }

  if (!isPlaying) {
    audioPlayer.play();
    isPlaying = true;
    playPauseBtn.textContent = "Pause";
  } else {
    audioPlayer.pause();
    isPlaying = false;
    playPauseBtn.textContent = "Play";
  }
});

stopBtn.addEventListener("click", function () {
  if (audioPlayer.src) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    isPlaying = false;
    playPauseBtn.textContent = "Play";
  }
});

audioPlayer.addEventListener("ended", function () {
  isPlaying = false;
  playPauseBtn.textContent = "Play";
});

// 🧠 Function to draw waveform
function drawWaveform(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const arrayBuffer = e.target.result;
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    audioCtx.decodeAudioData(arrayBuffer, function (audioBuffer) {
      decodedBuffer = audioBuffer; // Store buffer for cropping later
      const rawData = audioBuffer.getChannelData(0); // First channel
      const samples = canvas.width;
      const blockSize = Math.floor(rawData.length / samples);
      const normalizedData = [];

      for (let i = 0; i < samples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[i * blockSize + j]);
        }
        normalizedData.push(sum / blockSize);
      }

      drawCanvas(normalizedData);
    }, (err) => {
      console.error("Error decoding audio:", err);
    });
  };

  reader.readAsArrayBuffer(file);
}

function drawCanvas(data) {
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const maxHeight = height;

  data.forEach((val, i) => {
    const barHeight = val * maxHeight;
    const x = i;
    ctx.fillStyle = "#000"; // fix invalid hex color "#00000"
    ctx.fillRect(x, maxHeight - barHeight, 1, barHeight);
  });
}

const cropStartInput = document.getElementById("cropStart");
const cropEndInput = document.getElementById("cropEnd");
const cropBtn = document.getElementById("applyCropBtn");

cropBtn.addEventListener("click", function () {
  const start = parseFloat(cropStartInput.value);
  const end = parseFloat(cropEndInput.value);

  if (!decodedBuffer) {
    alert("No audio loaded to crop!");
    return;
  }

  if (isNaN(start) || isNaN(end) || start >= end || end > decodedBuffer.duration) {
    alert("Invalid start or end time.");
    return;
  }

  const sampleRate = decodedBuffer.sampleRate;
  const startSample = Math.floor(start * sampleRate);
  const endSample = Math.floor(end * sampleRate);
  const frameCount = endSample - startSample;

  const croppedBuffer = new AudioContext().createBuffer(
    decodedBuffer.numberOfChannels,
    frameCount,
    sampleRate
  );

  for (let i = 0; i < decodedBuffer.numberOfChannels; i++) {
    const channelData = decodedBuffer.getChannelData(i).slice(startSample, endSample);
    croppedBuffer.copyToChannel(channelData, i);
  }

  const wavBuffer = bufferToWave(croppedBuffer, frameCount);
  const blob = new Blob([wavBuffer], { type: "audio/wav" });
  const croppedURL = URL.createObjectURL(blob);

  audioPlayer.src = croppedURL;
  isPlaying = false;
  playPauseBtn.textContent = "Play";

  decodedBuffer = croppedBuffer;
  drawWaveformFromBuffer(decodedBuffer);
});

// Convert AudioBuffer to Blob
function bufferToWave(abuffer, frameCount) {
  const numOfChan = abuffer.numberOfChannels;
  const sampleRate = abuffer.sampleRate;
  const length = frameCount * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);

  let offset = 0;
  let pos = 0;

  function setUint16(data) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data) {
    view.setUint32(pos, data, true);
    pos += 4;
  }

  // Write WAV container header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // PCM
  setUint16(1); // format = 1 (PCM)
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * numOfChan * 2); // byte rate
  setUint16(numOfChan * 2); // block align
  setUint16(16); // bits per sample

  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4); // data chunk length

  // Write PCM samples
  const channels = [];
  for (let i = 0; i < numOfChan; i++) {
    channels.push(abuffer.getChannelData(i));
  }

  for (let i = 0; i < frameCount; i++) {
    for (let ch = 0; ch < numOfChan; ch++) {
      let sample = Math.max(-1, Math.min(1, channels[ch][i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
  }

  return buffer;
}


// Draw waveform from existing buffer (no file)
function drawWaveformFromBuffer(buffer) {
  const rawData = buffer.getChannelData(0); // First channel
  const samples = canvas.width;
  const blockSize = Math.floor(rawData.length / samples);
  const normalizedData = [];

  for (let i = 0; i < samples; i++) {
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum += Math.abs(rawData[i * blockSize + j]);
    }
    normalizedData.push(sum / blockSize);
  }

  drawCanvas(normalizedData);
}

// 🎬 Movies Rounds - Upload Movie Question
document.getElementById("subMovie").addEventListener("click", async function (event) {
  event.preventDefault();
  console.log("🎬 Submit Movie button clicked!");

  const movieFileInput = document.getElementById("movieFile");          // Required movie file
  const imageFileInput = document.getElementById("imageFileMovie");     // Optional image file

  // Text inputs
  const movieTitle = document.getElementById("movieTitle")?.value.trim() || "";
  const wrongAnswers = document.getElementById("wrongAnswerMov")?.value.trim() || "";
  const tags = document.getElementById("movieTagsMov")?.value.trim() || "";
  const movieTitleRight = document.getElementById("movieTitleRight")?.value.trim() || "";
  const tagsRight = document.getElementById("rightsecTagsMovie")?.value.trim() || "";

  // ✅ Validate required fields
  if (!movieFileInput?.files.length) {
    return alert("❌ Please select a movie file to upload.");
  }
  if (!movieTitle) {
    return alert("❌ Movie title is required.");
  }

  const formData = new FormData();
  formData.append("movieFile", movieFileInput.files[0]); // Required

  if (imageFileInput?.files.length) {
    formData.append("imageFileMovie", imageFileInput.files[0]); // Optional
  }

  // Append metadata
  formData.append("movieTitle", movieTitle);
  formData.append("wrongAnswerMov", wrongAnswers);       // Match backend key
  formData.append("movieTagsMov", tags);                 // Match backend key
  formData.append("movieTitleRight", movieTitleRight);
  formData.append("rightsecTagsMovie", tagsRight);

  try {
    const response = await fetch("http://localhost:4001/submit-movie", {
      method: "POST",
      body: formData
    });

    const result = await response.json();
    console.log("📩 Server response:", result);

    if (response.ok && result.success) {
      alert("✅ Movie uploaded successfully!");
      setTimeout(() => {
      window.location.reload();
      }, 1000);

      // 🔄 Reset form fields
      movieFileInput.value = "";
      if (imageFileInput) imageFileInput.value = "";
      document.getElementById("movieTitle").value = "";
      document.getElementById("wrongAnswerMov").value = "";
      document.getElementById("movieTagsMov").value = "";
      document.getElementById("movieTitleRight").value = "";
      document.getElementById("rightsecTagsMovie").value = "";
    } else {
      alert("❌ Upload failed: " + (result.error || "Unknown error"));
    }
  } catch (err) {
    console.error("🔥 Upload error:", err);
    alert("❌ A network error occurred while uploading.");
  }
});

// DOM references
const movieFileInput = document.getElementById("movieFile");
const playPauseBtnMov = document.getElementById("playPauseBtnMov");
const stopBtnMov = document.getElementById("stopBtnMov");
const applyCropBtnMov = document.getElementById("applyCropBtnMov");
const cropStartMov = document.getElementById("cropStartMov");
const cropEndMov = document.getElementById("cropEndMov");
const videoPlayer = document.getElementById("videoPlayer");
const exportMovBtn = document.getElementById("exportMovBtn");

let videoURL = null;
let cropEndTime = 0;
let cropActive = false;

// Handle file input
movieFileInput.addEventListener("change", function () {
  const file = this.files[0];
  if (!file) return;

  if (videoURL) URL.revokeObjectURL(videoURL);

  videoURL = URL.createObjectURL(file);
  videoPlayer.src = videoURL;
  cropActive = false;

  videoPlayer.onloadedmetadata = () => {
    cropStartMov.value = 0;
    cropEndMov.value = videoPlayer.duration.toFixed(2);
  };
});

// Play/pause button logic
playPauseBtnMov.addEventListener("click", () => {
  if (videoPlayer.paused) {
    const start = parseFloat(cropStartMov.value);
    const end = parseFloat(cropEndMov.value);

    if (!validateCropTimes(start, end, videoPlayer.duration)) return;

    videoPlayer.currentTime = start;
    cropEndTime = end;
    cropActive = true;
    videoPlayer.play();
    playPauseBtnMov.textContent = "Pause";
  } else {
    videoPlayer.pause();
    playPauseBtnMov.textContent = "Play";
  }
});

// Stop button
stopBtnMov.addEventListener("click", () => {
  videoPlayer.pause();
  videoPlayer.currentTime = 0;
  cropActive = false;
  playPauseBtnMov.textContent = "Play";
});

// Pause at crop end
videoPlayer.addEventListener("timeupdate", () => {
  if (cropActive && videoPlayer.currentTime >= cropEndTime) {
    videoPlayer.pause();
    playPauseBtnMov.textContent = "Play";
    cropActive = false;
  }
});

// Validate times
function validateCropTimes(start, end, videoDuration) {
  if (isNaN(start) || isNaN(end)) {
    alert("Start and end times must be valid numbers.");
    return false;
  }
  if (start >= end) {
    alert("Start time must be less than end time.");
    return false;
  }
  if (start < 0 || end > videoDuration) {
    alert("Crop times must be within the video duration.");
    return false;
  }
  return true;
}

// Format time as HH:MM:SS
function formatTime(t) {
  const pad = (n) => String(Math.floor(n)).padStart(2, "0");
  const hrs = pad(t / 3600);
  const mins = pad((t % 3600) / 60);
  const secs = pad(t % 60);
  return `${hrs}:${mins}:${secs}`;
}

// Upload and crop video
async function uploadAndCropVideo(start, end) {
  const file = movieFileInput.files[0];
  if (!file) return alert("No video selected");

  const { createFFmpeg, fetchFile } = window.FFmpeg;
  const ffmpeg = createFFmpeg({ log: true });

  try {
    console.log("Loading FFmpeg...");
    await ffmpeg.load();
    console.log("FFmpeg loaded successfully.");

    const inputFileName = "input.mp4";
    const outputFileName = "cropped.mp4";

    console.log("Writing input file...");
    const data = await fetchFile(file);
    ffmpeg.FS("writeFile", inputFileName, data);

    const startTime = formatTime(start);
    const duration = (end - start).toFixed(2);

    console.log(`Cropping from ${startTime} for ${duration} seconds...`);
    await ffmpeg.run(
      "-i", inputFileName,
      "-ss", startTime,
      "-t", duration,
      "-c:v", "copy",
      "-c:a", "copy",
      outputFileName
    );

    console.log("Reading output file...");
    const outputData = ffmpeg.FS("readFile", outputFileName);
    const videoBlob = new Blob([outputData.buffer], { type: "video/mp4" });
    const url = URL.createObjectURL(videoBlob);

    console.log("Triggering download...");
    const a = document.createElement("a");
    a.href = url;
    a.download = "cropped-video.mp4";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("FFmpeg error:", err);
    alert("Failed to crop/export video. See console for details.");
  }
}


// Export cropped video
exportMovBtn.addEventListener("click", async () => {
  const start = parseFloat(cropStartMov.value);
  const end = parseFloat(cropEndMov.value);

  if (!validateCropTimes(start, end, videoPlayer.duration)) return;

  exportMovBtn.disabled = true;
  exportMovBtn.textContent = "Exporting...";

  await uploadAndCropVideo(start, end);

  exportMovBtn.disabled = false;
  exportMovBtn.textContent = "Save / Export";
});

// Submit Image Only (Movies section)
document.getElementById('subMovieImg').addEventListener('click', function () {
  const fileInput = document.getElementById('imageFileMovie');
  const movieTitle = document.getElementById('movieTitleRight').value;
  const tags = document.getElementById('rightsecTagsMovie').value;

  if (!fileInput.files.length) {
    alert("Please select an image file.");
    return;
  }

  const formData = new FormData();
  formData.append('imageFileMovie', fileInput.files[0]);
  formData.append('movieTitleRight', movieTitle);
  formData.append('rightsecTagsMovie', tags);

  fetch('http://localhost:4001/submit-image', {  // Make sure the URL matches your backend route and port
    method: 'POST',
    body: formData,
  })
  .then(response => {
    if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
    return response.json();
  })
  .then(result => {
    console.log('Success:', result);
    alert("Image submitted successfully!");
    // Optional: Clear form fields after success
    fileInput.value = "";
    document.getElementById('movieTitleRight').value = "";
    document.getElementById('rightsecTagsMovie').value = "";
  })
  .catch(error => {
    console.error('Error:', error);
    alert("Error submitting image: " + error.message);
  });
});


document.getElementById('imageFileMovie').addEventListener('change', function (event) {
  const file = event.target.files[0];
  const preview = document.getElementById('imagePreviewMovie');

  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      preview.innerHTML = `
        <img src="${e.target.result}" 
             alt="Preview" 
             style="max-width: 100%; height: auto; border-radius: 5px;" />
      `;
    };
    reader.readAsDataURL(file);
  } else {
    preview.innerHTML = `
      <strong class="image-preview-text" id="image-preview-textMovie">
        Drag and drop an image here, or select image from database
      </strong>
    `;
  }
});

function setupMovieSearchInputs() {
  const leftInput = document.getElementById("searchImagesMovie");
  const rightInput = document.getElementById("searchImagesMovieRight");

  if (leftInput) {
    leftInput.addEventListener("input", (e) => {
      const query = e.target.value.trim();
      if (query) fetchMoviesSearch(query, "left");
    });
  }

  if (rightInput) {
    rightInput.addEventListener("input", (e) => {
      const query = e.target.value.trim();
      if (query) fetchMoviesSearch(query, "right");
    });
  }
}

// Main search logic
async function fetchMoviesSearch(query, side = "left") {
  const containerId = side === "right" ? "imageSearchResultsMovieRight" : "imageSearchResultsMovie";
  const resultContainer = document.getElementById(containerId);
  resultContainer.innerHTML = "<p>Loading...</p>";

  try {
    const response = await fetch(`http://localhost:4001/movies/search?query=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    console.log(`🎬 ${side.toUpperCase()} Search Results:`, data); // Debug log for fetched data

    if (data.success && Array.isArray(data.movies) && data.movies.length > 0) {
      resultContainer.innerHTML = data.movies.map((movie) => {
        const imageFiles = Array.isArray(movie.image?.file)
          ? movie.image.file
          : [movie.image?.file].filter(Boolean);

        const imageTitlesRaw = side === "right" ? movie.image?.title_right : movie.image?.title;
        const imageTitles = Array.isArray(imageTitlesRaw)
          ? imageTitlesRaw
          : [imageTitlesRaw];

        return `
          <div class="movie-block" style="margin-bottom: 1.5rem;">

            <table class="movie-images-table" border="1" cellpadding="10" cellspacing="0" style="margin-bottom: 1rem; width: 100%; text-align: center;">
              <thead style="background: linear-gradient(#2575fc);">
                <tr>
                  <th>Image</th>
                  <th>Title</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${imageFiles.map((file, idx) => {
                  const title = imageTitles[idx] || "Untitled";
                  const imageObj = {
                    file_name: file,
                    image_title: title,
                    movie_id: movie.id,
                    movie_title: movie.title,
                    tags: movie.tags,
                    tags_right: movie.image?.tags_right || [],  // Ensure the tags_right field is passed correctly
                    wrong_answers: movie.wrong_answers,
                    uploaded_movie: movie.movie_file || ""
                  };

                  return `
                    <tr>
                      <td>
                        <img src="/uploads/${file}" alt="${movie.title}" style="width: 120px; border-radius: 6px;" />
                      </td>
                      <td>${movie.title}</td>
                      <td>
                        <button type="button" class="select-movie-image" data-side="${side}" data-image='${JSON.stringify(imageObj).replace(/'/g, "&apos;")}' data-target-side="${side}">
                          Select
                        </button>
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        `;
      }).join("");

      // Ensure the Select button event listeners are correctly attached
      document.querySelectorAll(`#${containerId} .select-movie-image`).forEach((button) => {
        button.addEventListener("click", () => {
          const imageData = JSON.parse(button.dataset.image.replace(/&apos;/g, "'"));
          const targetSide = button.dataset.side;
          console.log("📌 Selected Image Data:", imageData); // Debug log for selected image data
          handleMovieImageSelect(imageData, targetSide);
        });
      });

    } else {
      resultContainer.innerHTML = "<p>No movies found.</p>";
    }

  } catch (error) {
    console.error("❌ Error fetching movies:", error);
    resultContainer.innerHTML = `<p>Error loading movies: ${error.message}</p>`;
  }
}

// Fill form fields based on which side was selected
function handleMovieImageSelect(data, side = "left") {
  const previewRight = document.getElementById("imagePreviewMovie"); // RIGHT section only
  const fileName = data.file_name || data.image?.file || "";

  console.log("📌 Handling Movie Image Select:", data);
  console.log("📌 File name:", fileName);

  if (side === "right" && previewRight) {
    if (fileName) {
      previewRight.innerHTML = `
        <img src="/uploads/${encodeURIComponent(fileName)}" 
             alt="${data.image_title || data.image?.title_right || 'Preview'}" 
             style="max-width: 150px;" />
      `;
    } else {
      previewRight.innerHTML = `<strong>No image available.</strong>`;
    }
  }

  if (side === "left") {
    const movieTitleInput = document.getElementById("movieTitle");
    if (movieTitleInput) movieTitleInput.value = data.movie_title || "";

    const wrongAnswerInput = document.getElementById("wrongAnswerMov");
    if (wrongAnswerInput) wrongAnswerInput.value = data.wrong_answers || "";

    const movieTagsInput = document.getElementById("movieTagsMov");
    if (movieTagsInput) movieTagsInput.value = data.tags || "";

    const videoElement = document.getElementById("videoPlayer");
    if (videoElement) {
      videoElement.src = data.uploaded_movie ? `/uploads/${data.uploaded_movie}` : "";
    }

    const selectedMovieIdLeft = document.getElementById("selectedMovieIdLeft");
    if (selectedMovieIdLeft) selectedMovieIdLeft.value = data.movie_id || "";

    const selectedMovieIdRight = document.getElementById("selectedMovieIdRight");
    if (selectedMovieIdRight) selectedMovieIdRight.value = data.id || "";

    const movieFileInput = document.getElementById("movieFile");
    if (movieFileInput) movieFileInput.value = data.uploaded_movie || "";

    // Clear RIGHT form fields only
    const movieTitleRightInput = document.getElementById("movieTitleRight");
    if (movieTitleRightInput) movieTitleRightInput.value = "";

    const rightsecTagsMovieInput = document.getElementById("rightsecTagsMovie");
    if (rightsecTagsMovieInput) rightsecTagsMovieInput.value = "";

    const imageFileMovieInput = document.getElementById("imageFileMovie");
    if (imageFileMovieInput) imageFileMovieInput.value = "";

    // Update LEFT edit button
    const editleftBtn = document.getElementById("editImageMovieLeft");
    if (editleftBtn) {
      editleftBtn.textContent = "Update";
      editleftBtn.dataset.mode = "update";
      console.log("🟢 Left edit button set to Update");
    }

  } else if (side === "right") {
    const movieTitleRightInput = document.getElementById("movieTitleRight");
    if (movieTitleRightInput) movieTitleRightInput.value = data.image_title || "";

    const rightsecTagsMovieInput = document.getElementById("rightsecTagsMovie");
    if (rightsecTagsMovieInput) rightsecTagsMovieInput.value = (data.tags_right || []).join(', ');

    const imageFileMovieInput = document.getElementById("imageFileMovie");
    if (imageFileMovieInput) imageFileMovieInput.value = "";

    const selectedMovieIdRight = document.getElementById("selectedMovieIdRight");
    if (selectedMovieIdRight) selectedMovieIdRight.value = data.movie_id || "";

  

    const editrightBtn = document.getElementById("editImageMovieRight");
    if (editrightBtn) {
      editrightBtn.textContent = "Update";
      editrightBtn.dataset.mode = "update";
      console.log("🟢 Right edit button set to Update");
    }
  }
}

// Function to populate the movie form for editing
function populateMovieForEditing(movieData, side = "left") {
  const previewRight = document.getElementById("imagePreviewMovie"); // RIGHT preview only

  // Only update preview if side is right
  if (side === "right" && previewRight) {
    if (movieData.file_name) {
      previewRight.innerHTML = `
        <img src="/uploads/${movieData.file_name}" alt="Preview" style="max-width: 100%; height: auto; border-radius: 5px;" />
      `;
    } else {
      previewRight.innerHTML = `
        <strong class="image-preview-text" id="image-preview-textMovie">
          Drag and drop an image here, or select an image from the database
        </strong>
      `;
    }
  }

  if (side === "left") {
    // Populate left-side fields
    document.getElementById("movieTitle").value = movieData.movie_title || "";
    document.getElementById("wrongAnswerMov").value = movieData.wrong_answers || "";
    document.getElementById("movieTagsMov").value = movieData.tags || "";

    const videoElement = document.getElementById("videoPlayer");
    if (videoElement) {
      videoElement.src = movieData.uploaded_movie ? `/uploads/${movieData.uploaded_movie}` : "";
    }

    document.getElementById("movieTitleRight").value = "";
    document.getElementById("rightsecTagsMovie").value = "";

    // ✅ Update LEFT edit button
    const editleftBtn = document.getElementById("editImageMovieLeft");
    if (editleftBtn) {
      editleftBtn.textContent = "Update";
      editleftBtn.dataset.mode = "update";
      console.log("🟢 Left edit button set to Update (populateMovieForEditing)");
    }

  } else if (side === "right") {
    // Populate right-side fields
    document.getElementById("movieTitleRight").value = movieData.image_title || "";
    document.getElementById("rightsecTagsMovie").value = movieData.tags_right?.join(', ') || "";

    document.getElementById("movieTitle").value = "";
    document.getElementById("wrongAnswerMov").value = "";
    document.getElementById("movieTagsMov").value = "";

    // ✅ Update RIGHT edit button
    const editrightBtn = document.getElementById("editImageMovieRight");
    if (editrightBtn) {
      editrightBtn.textContent = "Update";
      editrightBtn.dataset.mode = "update";
      console.log("🟢 Right edit button set to Update (populateMovieForEditing)");
    }
  }
}

// Initialize listeners (if you need to set up search input listeners)
setupMovieSearchInputs();


//Clear Movie fields
document.getElementById("clearImageFormMovieLeft").addEventListener("click", () => {
  // Clear left section fields
  document.getElementById("movieTitle").value = "";
  document.getElementById("wrongAnswerMov").value = "";
  document.getElementById("movieTagsMov").value = "";
  document.getElementById("selectedImageMovie").value = "";
  document.getElementById("selectedMovieId").value = "";
  document.getElementById("movieFile").value = "";

  const videoElement = document.getElementById("videoPlayer");
  if (videoElement) videoElement.src = "";

  const preview = document.getElementById("imagePreviewMovie");
  if (preview) preview.innerHTML = `<strong class="image-preview-text" id="image-preview-textMovie">
    Drag and drop an image here, or select image from database
  </strong>`;
});

document.getElementById("clearImageFormMovieRight").addEventListener("click", () => {
  // Clear right section fields
  document.getElementById("movieTitleRight").value = "";
  document.getElementById("rightsecTagsMovie").value = "";
  document.getElementById("imageFileMovie").value = "";

  const preview = document.getElementById("imagePreviewMovie");
  if (preview) preview.innerHTML = `<strong class="image-preview-text" id="image-preview-textMovie">
    Drag and drop an image here, or select image from database
  </strong>`;
});
  
// ✅ Confirm script is loaded
console.log("✅ script.js loaded");

let currentMovieIdLeft = null;
let currentMovieIdRight = null;

// ✅ Edit Movie Left
document.getElementById("editImageMovieLeft").addEventListener("click", async function () {
  const formData = new FormData();

  // Get the selected movie ID from the hidden input field (make sure it holds the correct movie ID)
  const selectedMovieId = document.getElementById("selectedMovieIdLeft").value;
  console.log("📌 selectedMovieIdLeft:", selectedMovieId); // Log for debugging

  // Get other form field values
  const movieTitle = document.getElementById("movieTitle").value;
  const wrongAnswer = document.getElementById("wrongAnswerMov").value;
  const tags = document.getElementById("movieTagsMov").value;
  const movieFile = document.getElementById("movieFile").files[0];

  // Validate if movie ID is provided
  if (!selectedMovieId) {
    alert("Movie ID is missing.");
    return;
  }

  // Append form data
  formData.append("selectedMovieId", selectedMovieId); // Send the correct movie ID
  formData.append("movieTitleLeft", movieTitle);
  formData.append("wrongAnswerMovie", wrongAnswer);
  formData.append("leftsecTagsMovie", tags);

  // Check if there's a file and append it
  if (movieFile) {
    formData.append("movieFile", movieFile);
  }

  // Make the API request
  try {
    const response = await fetch("http://localhost:4001/update-movie-left", {
      method: "POST", // Use POST as per your backend API
      body: formData,
    });

    // Check if the response is successful
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    // Parse the JSON response from the backend
    const result = await response.json();
    
    // Handle successful or failed update
    if (result.success) {
      alert("✅ Movie (Left) updated successfully!");
    } else {
      alert("❌ Failed to update movie: " + result.error);
    }
  } catch (error) {
    // Log and show error if the request fails
    console.error("❌ Error:", error);
    alert("❌ Error updating movie.");
  }
});


// ✅ Edit Movie Right
document.getElementById("editImageMovieRight").addEventListener("click", async function () {
  const formData = new FormData();
  const selectedMovieId = document.getElementById("selectedMovieIdRight").value;
  const movieTitle = document.getElementById("movieTitleRight").value;
  const tags = document.getElementById("rightsecTagsMovie").value;
  const imageFile = document.getElementById("imageFileMovie").files[0];

  if (!selectedMovieId) {
    alert("Movie ID is missing.");
    return;
  }

  formData.append("selectedMovieId", selectedMovieId);
  formData.append("movieTitleRight", movieTitle);
  formData.append("rightsecTagsMovie", tags);

  if (imageFile) {
    formData.append("imageFileMovie", imageFile);
  }

  try {
    const response = await fetch("http://localhost:4001/update-movie-right", {
      method: "POST", // ✅ CHANGED from PUT to POST
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    if (result.success) {
      alert("✅ Movie (Right) updated successfully!");
    } else {
      alert("❌ Failed to update movie image: " + result.error);
    }
  } catch (error) {
    console.error("❌ Error:", error);
    alert("❌ Error updating movie image.");
  }
});

// Fetch and display the updated list of movies
function fetchMovies() {
  fetch("http://localhost:4001/movies")
    .then(res => res.json())
    .then(data => {
      console.log("Fetched movies:", data);
      // TODO: Update the DOM with movie list
    })
    .catch(err => console.error("Error fetching movies:", err));
}

// Fetch and display the updated list of movie images
function fetchImages() {
  fetch("http://localhost:4001/movie-images")
    .then(res => res.json())
    .then(data => {
      console.log("Fetched movie images:", data);
      // TODO: Update the DOM to show images
    })
    .catch(err => console.error("Error fetching movie images:", err));
}

// Helper function to delete movie or movie image
async function deleteMovie(url, id, confirmMessage, successMessage, refreshFunction, inputId) {
  if (!id) {
    alert("⚠️ No item selected for deletion!");
    return;
  }

  if (!confirm(confirmMessage)) return;

  showLoading();
  try {
    const response = await fetch(`${url}/${id}`, { method: "DELETE" });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Server error: ${response.status} - ${text}`);
    }

    const result = await response.json();
    if (result.success) {
      alert(successMessage);
      if (typeof refreshFunction === "function") {
        refreshFunction();
      }
      const inputElem = document.getElementById(inputId);
      if (inputElem) inputElem.value = "";
    } else {
      alert("❌ Failed to delete: " + (result.error || "Unknown error"));
    }
  } catch (error) {
    console.error("Error deleting:", error.message || error);
    alert("❌ Error deleting: " + (error.message || error));
  } finally {
    hideLoading();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded fired");

  document.body.addEventListener("click", (event) => {
    const leftBtn = event.target.closest("#deleteImageMovieLeft");
    const rightBtn = event.target.closest("#deleteImageMovieRight");

    if (leftBtn) {
      // Left side: Deleting movie image
      const leftImageIdElem = document.getElementById("selectedMovieIdLeft");
      const leftImageId = leftImageIdElem ? leftImageIdElem.value : null;

      deleteMovie(
        "http://localhost:4001/delete-movie", // ✅ This is the correct endpoint for image deletion
        leftImageId,
        "Are you sure you want to delete this movie image?",
        "🖼️ Movie image deleted successfully.",
        fetchImages,
        "selectedMovieIdLeft"
      );
    } else if (rightBtn) {
      // Right side: Deleting movie and its associated image
      const rightMovieIdElem = document.getElementById("selectedMovieIdRight");
      const rightMovieId = rightMovieIdElem ? rightMovieIdElem.value : null;

      deleteMovie(
        "http://localhost:4001/delete-movie-image", // ✅ This is the correct endpoint for movie deletion
        rightMovieId,
        "Are you sure you want to delete this movie (and its image)?",
        "🎬 Movie deleted successfully!",
        fetchMovies,
        "selectedMovieIdRight"
      );
    }
  });
});

//Wager Round Preview function for displaying selected images
// Preview function for displaying selected images
function previewImage(files, previewContainerId) {
  const previewContainer = document.getElementById(previewContainerId);
  previewContainer.innerHTML = ''; // Clear previous previews

  if (!files || files.length === 0) return;

  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      const img = document.createElement('img');
      img.src = e.target.result;
      img.style.maxWidth = '100%';
      img.style.maxHeight = '200px';
      img.style.marginTop = '10px';
      img.style.border = '1px solid #ccc';
      previewContainer.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}

// Preview for Left image input
document.getElementById('imageFileWagerLeft').addEventListener('change', function(event) {
  previewImage(event.target.files, 'wagerImageLeft');
});

// Preview for Right image input
document.getElementById('imageFileWagerRight').addEventListener('change', function(event) {
  previewImage(event.target.files, 'wagerImageRight');
});

// Submit only Right Image (button: subWagerImg)
document.getElementById('subWagerImg').addEventListener('click', async () => {
  const imageFileInputRight = document.getElementById('imageFileWagerRight');
  const imageFileRight = imageFileInputRight.files[0];

  if (!imageFileRight) {
    alert('Please select an image file on the right.');
    return;
  }

  const formData = new FormData();
  formData.append('imageFileWagerRight', imageFileRight);

  try {
    const response = await fetch('http://localhost:4001/submit-wager', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      alert('Upload failed: ' + errorText);
      return;
    }

    alert('Image upload successful!');
    imageFileInputRight.value = '';
    document.getElementById('wagerImageRight').innerHTML = '';
    setTimeout(() => {
    window.location.reload();
  }, 1000);
  } catch (error) {
    console.error('Error:', error);
    alert('An error occurred during submission.');
  }
});

// Submit with Left & Right Images + Answers (button: subWager)
document.getElementById('subWager').addEventListener('click', async () => {
  const imageFileInputLeft = document.getElementById('imageFileWagerLeft');
  const imageFileLeft = imageFileInputLeft.files[0];

  const imageFileInputRight = document.getElementById('imageFileWagerRight');
  const imageFileRight = imageFileInputRight.files[0];

  if (!imageFileLeft) {
    alert('Please select an image file on the left.');
    return;
  }

  if (!imageFileRight) {
    alert('Please select an image file on the right.');
    return;
  }

  const correctAnswer = document.getElementById('correctAnswerWager').value.trim();
  const wrongAnswer = document.getElementById('wrongAnswerWager').value.trim();
  const wagerTags = document.getElementById('rightsecTagsWager').value.trim();

  if (!correctAnswer || !wrongAnswer) {
    alert('Please fill in both correct and wrong answers.');
    return;
  }

  const formData = new FormData();
  formData.append('imageFileWagerLeft', imageFileLeft);
  formData.append('imageFileWagerRight', imageFileRight);
  formData.append('correctAnswerWager', correctAnswer);
  formData.append('wrongAnswerWager', wrongAnswer);
  formData.append('rightsecTagsWager', wagerTags);

  try {
    const response = await fetch('http://localhost:4001/submit-wager', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      alert('Upload failed: ' + errorText);
      return;
    }

    alert('Upload successful!');
    setTimeout(() => {
    window.location.reload();
  }, 1000);
    // Clear inputs and previews
    imageFileInputLeft.value = '';
    imageFileInputRight.value = '';
    document.getElementById('correctAnswerWager').value = '';
    document.getElementById('wrongAnswerWager').value = '';
    document.getElementById('rightsecTagsWager').value = '';
    document.getElementById('wagerImageLeft').innerHTML = '';
    document.getElementById('wagerImageRight').innerHTML = '';
  } catch (error) {
    console.error('Error submitting wager:', error);
    alert('An error occurred during submission.');
  }
});

// Autofill & Search Wager Submissions
function populateWagerForm(data) {
  // Fill hidden and text inputs
  document.getElementById("selectedWagerIdLeft").value = data.idLeft || "";
  document.getElementById("selectedWagerIdRight").value = data.idRight || "";
  document.getElementById("correctAnswerWager").value = data.correct_answer || "";
  document.getElementById("wrongAnswerWager").value = data.wrong_answer || "";
  document.getElementById("rightsecTagsWager").value = data.wager_tags || "";

  // Update wagerImageLeft div with image
  const wagerImageLeftDiv = document.getElementById("wagerImageLeft");
  wagerImageLeftDiv.innerHTML = `
    <img src="/uploads/${data.image_left}" alt="Left Wager Image" style="max-width: 100%; max-height: 150px; display: block; margin: 0 auto;">
  `;

  // Update wagerImageRight div with image
  const wagerImageRightDiv = document.getElementById("wagerImageRight");
  wagerImageRightDiv.innerHTML = `
    <img src="/uploads/${data.image_right}" alt="Right Wager Image" style="max-width: 100%; max-height: 150px; display: block; margin: 0 auto;">
  `;
}

async function fetchWagerSubmissionsSearch(query, side) {
  const containerLeft = document.getElementById("imageSearchResultsWagerLeft");
  const containerRight = document.getElementById("imageSearchResultsWagerRight");

  if (side === "left") containerLeft.innerHTML = "";
  if (side === "right") containerRight.innerHTML = "";

  showLoading();

  try {
    const res = await fetch(`http://localhost:4001/wager-submissions/search?query=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data.success && Array.isArray(data.submissions)) {
      data.submissions.forEach((item) => {
        // LEFT SIDE
        if (side === "left" && item.image_left) {
          const tableLeft = document.createElement("table");
          tableLeft.className = "song-table";
          tableLeft.setAttribute("data-id", item.id_left || item.id || "");
          tableLeft.setAttribute("border", "1");
          tableLeft.setAttribute("cellpadding", "10");
          tableLeft.setAttribute("cellspacing", "0");
          tableLeft.style = "margin-bottom: 1rem; width: 100%; text-align: center;";
          tableLeft.innerHTML = `
            <thead style="background: linear-gradient(#2575fc);">
              <tr>
                <th>Image</th>
                <th>Correct</th>
                <th>Wrong</th>
                <th>Tags</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><img src="/uploads/${item.image_left}" alt="Left Image" style="width: 100px;"></td>
                <td>${item.correct_answer}</td>
                <td>${item.wrong_answer}</td>
                <td>${item.wager_tags}</td>
                <td><button type="button" class="select-wager">Select</button></td>
              </tr>
            </tbody>
          `;

          tableLeft.querySelector("button").addEventListener("click", () => {
            populateWagerForm({
              idLeft: item.id_left || item.id || "",
              correct_answer: item.correct_answer,
              wrong_answer: item.wrong_answer,
              wager_tags: item.wager_tags,
            });
            const wagerLeft = document.getElementById("wagerImageLeft");
            wagerLeft.innerHTML = `<img src="/uploads/${item.image_left}" alt="Selected Left Image" style="max-width: 100%;">`;
          });

          containerLeft.appendChild(tableLeft);
        }

        // RIGHT SIDE
        if (side === "right" && item.image_right) {
          const tableRight = document.createElement("table");
          tableRight.className = "song-table";
          tableRight.setAttribute("data-id", item.id_right || item.id || "");
          tableRight.setAttribute("border", "1");
          tableRight.setAttribute("cellpadding", "10");
          tableRight.setAttribute("cellspacing", "0");
          tableRight.style = "margin-bottom: 1rem; width: 100%; text-align: center;";
          tableRight.innerHTML = `
            <thead style="background: linear-gradient(#2575fc);">
              <tr>
                <th>Image</th>
                <th>Correct</th>
                <th>Wrong</th>
                <th>Tags</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><img src="/uploads/${item.image_right}" alt="Right Image" style="width: 100px;"></td>
                <td>${item.correct_answer}</td>
                <td>${item.wrong_answer}</td>
                <td>${item.wager_tags}</td>
                <td><button type="button" class="select-wager">Select</button></td>
              </tr>
            </tbody>
          `;

          tableRight.querySelector("button").addEventListener("click", () => {
            populateWagerForm({
              idRight: item.id_right || item.id || "",
              correct_answer: item.correct_answer,
              wrong_answer: item.wrong_answer,
              wager_tags: item.wager_tags,
            });
            const wagerRight = document.getElementById("wagerImageRight");
            wagerRight.innerHTML = `<img src="/uploads/${item.image_right}" alt="Selected Right Image" style="max-width: 100%;">`;
          });

          containerRight.appendChild(tableRight);
        }
      });
    } else {
      if (side === "left") containerLeft.innerHTML = "<p>No wager submissions found.</p>";
      if (side === "right") containerRight.innerHTML = "<p>No wager submissions found.</p>";
    }
  } catch (error) {
    console.error("Error fetching wager submissions:", error);
    if (side === "left") containerLeft.innerHTML = `<p>Error loading data</p>`;
    if (side === "right") containerRight.innerHTML = `<p>Error loading data</p>`;
  } finally {
    hideLoading();
  }
}

document.getElementById("searchImagesWagerLeft").addEventListener("input", (e) => {
  fetchWagerSubmissionsSearch(e.target.value, "left");
});

document.getElementById("searchImagesWagerRight").addEventListener("input", (e) => {
  fetchWagerSubmissionsSearch(e.target.value, "right");
});

//Clear Wager Left
document.getElementById("clearImageFormWagerLeft").addEventListener("click", () => {
  // Clear left section fields
  document.getElementById("correctAnswerWager").value = "";
  document.getElementById("wrongAnswerWager").value = "";
  document.getElementById("rightsecTagsWager").value = "";
  document.getElementById("searchImagesWagerLeft").value = "";
  document.getElementById("imageFileWagerLeft").value = "";
  document.getElementById("selectedWagerIdLeft").value = "";

  // Clear image preview
  const previewLeft = document.getElementById("wagerImageLeft");
  if (previewLeft) {
    previewLeft.innerHTML = `<strong class="image-preview-text" id="image-preview-textWagerLeft">
      Drag and drop an image here, or select image from database
    </strong>`;
  }

  // Clear search results
  document.getElementById("imageSearchResultsWagerLeft").innerHTML = "";
});

//Clear Wager Right
document.getElementById("clearImageFormWagerRight").addEventListener("click", () => {
  // Clear right section fields
  document.getElementById("correctAnswerWager").value = "";
  document.getElementById("wrongAnswerWager").value = "";
  document.getElementById("rightsecTagsWager").value = "";
  document.getElementById("searchImagesWagerRight").value = "";
  document.getElementById("imageFileWagerRight").value = "";
  document.getElementById("selectedWagerIdRight").value = "";

  // Clear image preview
  const previewRight = document.getElementById("wagerImageRight");
  if (previewRight) {
    previewRight.innerHTML = `<strong class="image-preview-text" id="image-preview-textWagerRight">
      Drag and drop an image here, or select image from database
    </strong>`;
  }

  // Clear search results
  document.getElementById("imageSearchResultsWagerRight").innerHTML = "";
});

(() => {
  // Update Wager Submission
  async function updateWagerSubmission(submissionId, side) {
    const formData = new FormData();

    if (side === "left") {
      const imageInput = document.getElementById("imageFileWagerLeft");
      const category = document.getElementById("categoryQuestions")?.value;

      if (imageInput?.files?.length) {
        formData.append("imageFileWagerLeft", imageInput.files[0]);
      }

      if (category) {
        formData.append("categoryName", category);
      }

      formData.append("selectedWagerIdLeft", submissionId);

    } else if (side === "right") {
      const imageInput = document.getElementById("imageFileWagerRight");
      const correctAnswer = document.getElementById("correctAnswerWager")?.value.trim();
      const wrongAnswer = document.getElementById("wrongAnswerWager")?.value.trim();
      const wagerTags = document.getElementById("rightsecTagsWager")?.value.trim();

      if (imageInput?.files?.length) {
        formData.append("imageFileWagerRight", imageInput.files[0]);
      }

      if (correctAnswer) {
        formData.append("correctAnswerWager", correctAnswer);
      }

      if (wrongAnswer) {
        formData.append("wrongAnswerWager", wrongAnswer);
      }

      if (wagerTags) {
        formData.append("rightsecTagsWager", wagerTags);
      }

      formData.append("selectedWagerIdRight", submissionId);
    }

    try {
      const response = await fetch(`http://localhost:4001/update-wager/${submissionId}`, {
        method: "PATCH",
        body: formData,
        mode: "cors"
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Server responded with:", errorText);
        throw new Error(`Status ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      if (result.success) {
        // ✅ Only show alert once
        alert("✅ Wager submission updated successfully!");
        console.log("✅ Update result:", result);

        // Clear inputs
        if (side === "left") {
          document.getElementById("imageFileWagerLeft").value = "";
          document.getElementById("selectedWagerIdLeft").value = "";
          const previewLeft = document.getElementById("previewImageWagerLeft");
          if (previewLeft) previewLeft.src = "";
        } else if (side === "right") {
          document.getElementById("imageFileWagerRight").value = "";
          document.getElementById("correctAnswerWager").value = "";
          document.getElementById("wrongAnswerWager").value = "";
          document.getElementById("rightsecTagsWager").value = "";
          document.getElementById("selectedWagerIdRight").value = "";
          const previewRight = document.getElementById("previewImageWagerRight");
          if (previewRight) previewRight.src = "";

          // Delay page reload to prevent race condition
          setTimeout(() => window.location.reload(), 300);
        }
      }

    } catch (error) {
      console.error("❌ Update error:", error);
      alert("❌ An error occurred while updating the wager submission:\n" + error.message);
    }
  }

  // Get selected wager ID by side
  function getSelectedWagerId(side) {
    const id = document.getElementById(`selectedWagerId${side === "left" ? "Left" : "Right"}`)?.value;
    return id?.trim() || null;
  }

  // DOM Ready - Attach Listeners Once
  document.addEventListener("DOMContentLoaded", () => {
    const updateLeftBtn = document.getElementById("editImageWagerLeft");
    const updateRightBtn = document.getElementById("editImageWagerRight");

    if (updateLeftBtn && !updateLeftBtn.dataset.listenerAttached) {
      updateLeftBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const submissionId = getSelectedWagerId("left");
        if (!submissionId) {
          alert("❗ Please select a Wager submission (left side) to update.");
          return;
        }
        updateWagerSubmission(submissionId, "left");
      });
      updateLeftBtn.dataset.listenerAttached = "true";
    }

    if (updateRightBtn && !updateRightBtn.dataset.listenerAttached) {
      updateRightBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const submissionId = getSelectedWagerId("right");
        if (!submissionId) {
          alert("❗ Please select a Wager submission (right side) to update.");
          return;
        }
        updateWagerSubmission(submissionId, "right");
      });
      updateRightBtn.dataset.listenerAttached = "true";
    }
  });
})();


// Delete Wager Submission
async function deleteWagerSubmission(submissionId) {
  if (!submissionId) {
    alert("⚠️ No submission ID provided for deletion.");
    return;
  }

  const confirmDelete = confirm("⚠️ Are you sure you want to delete this wager submission? This action cannot be undone.");
  if (!confirmDelete) return;

  try {
    const response = await fetch(`http://localhost:4001/delete-wager/${submissionId}`, {
      method: "DELETE",
      mode: "cors"
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Server responded with error:", errorText);
      throw new Error(`Status ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (result?.success) {
      alert("✅ Wager submission deleted successfully!");
      console.log("🧹 Delete result:", result);
      window.location.reload(); // Reload page to reflect changes
    } else {
      alert("⚠️ Deletion failed. Please try again.");
    }

  } catch (error) {
    console.error("❌ Delete error:", error);
    alert("❌ An error occurred while deleting the wager submission:\n" + error.message);
  }
}

// Get selected wager ID by side
function getSelectedWagerId(side) {
  const id = document.getElementById(`selectedWagerId${side === "left" ? "Left" : "Right"}`)?.value;
  return id?.trim() || null;
}

// Attach Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  // Update buttons
  document.getElementById("editImageWagerLeft")?.addEventListener("click", (e) => {
    e.preventDefault();
    const id = getSelectedWagerId("left");
    if (!id) {
      alert("❗ Please select a Wager submission (left side) to update.");
      return;
    }
    updateWagerSubmission(id, "left");
  });

  document.getElementById("editImageWagerRight")?.addEventListener("click", (e) => {
    e.preventDefault();
    const id = getSelectedWagerId("right");
    if (!id) {
      alert("❗ Please select a Wager submission (right side) to update.");
      return;
    }
    updateWagerSubmission(id, "right");
  });

  // Delete buttons
  document.getElementById("deleteImageWagerLeft")?.addEventListener("click", () => {
    const id = getSelectedWagerId("left");
    if (id) deleteWagerSubmission(id);
    else alert("❗ Please select a Wager submission (left side) to delete.");
  });

  document.getElementById("deleteImageWagerRight")?.addEventListener("click", () => {
    const id = getSelectedWagerId("right");
    if (id) deleteWagerSubmission(id);
    else alert("❗ Please select a Wager submission (right side) to delete.");
  });
  });

  
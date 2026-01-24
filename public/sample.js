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

        const categoryId = categoryElement.value;
        let formData = {};

        if (categoryId === "music-rounds") {
            formData = {
                file: croppedBuffer
                    ? await audioBufferToWaveBlob(croppedBuffer)
                    : document.getElementById("musicFileInput")?.files?.[0],
                artistName: document.getElementById("artistName")?.value.trim() || "",
                songTitle: document.getElementById("songTitle")?.value.trim() || "",
                featuring: document.getElementById("featuring")?.value.trim() || "",
                musicTags: document.getElementById("musicTags")?.value.trim() || ""
            };
        } else if (categoryId === "feud") {
            formData = {
                feudQuestionText: document.getElementById("feudQuestionText")?.value.trim() || "",
                answer1: document.getElementById("answer1")?.value.trim() || "",
                answer2: document.getElementById("answer2")?.value.trim() || "",
                answer3: document.getElementById("answer3")?.value.trim() || "",
                answer4: document.getElementById("answer4")?.value.trim() || ""
            };
        } else {
            formData = {
                questionText: document.getElementById("questionText")?.value.trim() || "",
                answer: document.getElementById("answer")?.value.trim() || "",
                wrongAnswers: document.getElementById("wrongAnswers")?.value.split(",").map(a => a.trim()) || [],
                tags: document.getElementById("tagsQuestions")?.value.trim() || "",
                multipleChoice: document.getElementById("multipleChoice")?.checked || false
            };
        }

        if (!validateForm(categoryId, formData)) return;

        showLoading();
        try {
            let response, result;

            if (categoryId === "music-rounds") {
                const formDataObj = new FormData();
                formDataObj.append("song", formData.file, `${formData.songTitle}.wav`);
                formDataObj.append("categoryId", categoryId);
                formDataObj.append("artistName", formData.artistName);
                formDataObj.append("songTitle", formData.songTitle);
                formDataObj.append("featuring", formData.featuring);
                formDataObj.append("musicTags", formData.musicTags);

                response = await fetch("http://127.0.0.1:4001/add-song", {
                    method: "POST",
                    body: formDataObj
                });
            } else {
                const questionData = {
                    categoryId,
                    questionText: formData.questionText,
                    tags: formData.tags,
                    multipleChoiceOnly: formData.multipleChoice,
                    answer: formData.answer,
                    wrongAnswers: formData.wrongAnswers
                };

                response = await fetch("http://127.0.0.1:4001/add-question", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(questionData)
                });
            }

            if (!response.ok) {
                console.log(response);
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            result = await response.json();

            if (result.success) {
                alert(`${categoryId === "music-rounds" ? "Song" : "Question"} added successfully!`);
                categoryId === "music-rounds" ? clearMusicForm() : clearQuestionForm();
                categoryId === "music-rounds" ? fetchSongs(categoryId) : fetchQuestions(categoryId);
                updateQuestionCount(categoryId);
            } else {
                alert(`Error: ${result.error || "Unknown error"}`);
            }
        } catch (error) {
            console.error("Error submitting form:", error);
            alert("Failed to submit: " + error.message);
        } finally {
            hideLoading();
        }
    });
});

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
        if (!formData.answer1.trim()) {
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
        if (!Array.isArray(formData.wrongAnswers)) {
            alert("Wrong answers should be a valid array.");
            return false;
        }
    }

    return true;
}

function showLoading() {
    console.log("Loading...");
}

function hideLoading() {
    console.log("Loading finished.");
}

function clearMusicForm() {
    document.getElementById("musicFileInput").value = "";
    document.getElementById("artistName").value = "";
    document.getElementById("songTitle").value = "";
    document.getElementById("featuring").value = "";
    document.getElementById("musicTags").value = "";
}

function clearQuestionForm() {
    document.getElementById("questionText").value = "";
    document.getElementById("answer").value = "";
    document.getElementById("wrongAnswers").value = "";
    document.getElementById("tagsQuestions").value = "";
    document.getElementById("multipleChoice").checked = false;
}

function fetchSongs(categoryId) {
    console.log(`Fetching songs for category: ${categoryId}`);
}

function fetchQuestions(categoryId) {
    console.log(`Fetching questions for category: ${categoryId}`);
}

function updateQuestionCount(categoryId) {
    console.log(`Updating question count for category: ${categoryId}`);
}

// Code adapted from: https://developpaper.com/nodejs-file-upload-monitoring-upload-progress/

const videoTitle = document.querySelector("#title");
const inputFile = document.querySelector("#file");
const selectedResolution = document.querySelector("#resolution");
const progressBarContainer = document.querySelector("#progressBar");
const progressBar = document.querySelector("#progress");
const statusText = document.querySelector("#status");

// ============== FUNCTIONS ============== //

// Submit
function submitUploadForm() {
  //Loading file with formdata
  const formData = new FormData();
  formData.append("title", videoTitle.value);
  formData.append("file", inputFile.files[0]);
  formData.append("resolution", selectedResolution.value);
  // Make progress bar visible
  progressBarContainer.style.visibility = "visible";
  //Upload file
  upload(formData);
}

async function upload(formData) {
  statusText.style.visibility = "hidden";
  statusText.textContent = "";
  axios
    .post("/upload/submit", formData, config)
    .then((response) => {
      //If upload successful, display success message and link to individual video page
      if (response.status === 200) {
        const uuid = response.data.uuid;
        console.log("Upload complete.");
        progressBarContainer.style.visibility = "hidden";
        progressBar.style.width = "0%";
        statusText.setAttribute("class", "alert alert-success");
        statusText.style.visibility = "visible";
        statusText.innerHTML =
          "Success! Your video has been uploaded and is now processing. When completed your video will appear <a href='../browse/video/" +
          uuid +
          "'>here</a>.";
      }
    })
    //Else, display error message
    .catch((error) => {
      progressBarContainer.style.visibility = "hidden";
      progressBar.style.width = "0%";
      if (error.response) {
        statusText.setAttribute("class", "alert alert-danger");
        statusText.style.visibility = "visible";
        statusText.textContent = error.response.data.message;
      }
    });
}

// ============== AXIOS CONFIG ============== //

const config = {
  //Note that the contenttype should be set to multipart / form data
  headers: {
    "Content-Type": "multipart/form-data",
  },
  //Listen for the onuploadprogress event
  onUploadProgress: (e) => {
    const { loaded, total } = e;
    //Using local progress events
    if (e.lengthComputable) {
      const progress = (loaded / total) * 100;
      progressBar.style.width = `${progress}%`;
    }
  },
};

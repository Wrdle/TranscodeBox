// Code adapted from: https://developpaper.com/nodejs-file-upload-monitoring-upload-progress/

const videoTitle = document.querySelector("#title");
const inputFile = document.querySelector("#file");
const selectedResolution = document.querySelector("#resolution");
const progressBarContainer = document.querySelector("#progressBar")
const progressBar = document.querySelector("#progress");
const errorText = document.querySelector("#error");

// ============== FUNCTIONS ============== //

// Submit
function submitUploadForm() {
  //Loading file with formdata
  const formData = new FormData();
  formData.append("title", videoTitle);
  formData.append("file", inputFile.files[0]);
  formData.append("resolution", selectedResolution.value);
  // Make progress bar visible
  progressBarContainer.style.visibility = "visible";
  //Upload file
  upload(formData);
}

async function upload(formData) {
  errorText.style.visibility = "hidden";
  errorText.textContent = "";
  axios
    .post("/upload/submit", formData, config)
    .then((response) => {
      if (response.status === 200) {
        console.log("Upload complete.");
        window.location.href = "/upload/submitted/" + response.data.uuid;
      }
    })
    .catch((error) => {
      //progressBar.style.visibility = "hidden";
      progressBarContainer.style.visibility = "hidden";
      progressBar.style.width = "0%";
      if (error.response) {
        errorText.style.visibility = "visible";
        errorText.textContent = error.response.data.message;
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
      progressBar.style.width = `${progress}%`
    }
  },
};

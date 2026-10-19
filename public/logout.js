
document.addEventListener("DOMContentLoaded", function () {
  const signOutBtn = document.querySelector(".sign-out");

  console.log("Logout script loaded. Button found:", !!signOutBtn);

  if (!signOutBtn) return;

  signOutBtn.addEventListener("click", async function () {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      });

      const data = await response.json();

      if (response.ok) {
        window.location.replace("/login.html");
      } else {
        alert(data.message || "Unable to sign out.");
      }
    } catch (error) {
      console.error("Logout error:", error);
      alert("Unable to sign out. Please try again.");
    }
  });
});

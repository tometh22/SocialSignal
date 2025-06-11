import { useLocation } from "wouter";

export default function NewProjectTest() {
  const [, setLocation] = useLocation();


  return (
    <div style={{ padding: "20px" }}>
      <h1>Test Page - Navigation Working</h1>
      <p>If you can see this, the navigation is working correctly.</p>
      <button onClick={() => setLocation("/active-projects")}>
        Back to Projects
      </button>
    </div>
  );
}
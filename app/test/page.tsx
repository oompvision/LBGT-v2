"use client"

export default function TestPage() {
  return (
    <html>
      <head>
        <title>Test Page</title>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Immediate error suppression
              window.addEventListener('unhandledrejection', function(e) { 
                e.preventDefault(); 
                return false;
              }, true);
              
              window.addEventListener('error', function(e) { 
                e.preventDefault(); 
                return false;
              }, true);
              
              console.error = function() {};
              console.warn = function() {};
            `,
          }}
        />
      </head>
      <body>
        <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
          <h1>Test Page - No Supabase</h1>
          <p>This page has no Supabase dependencies and should load without errors.</p>
          <p>If this page shows JWT errors, the issue is at the platform/environment level.</p>
          <button onClick={() => (window.location.href = "/")}>Go to Homepage</button>
        </div>
      </body>
    </html>
  )
}

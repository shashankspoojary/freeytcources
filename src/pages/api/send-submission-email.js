import nodemailer from 'nodemailer';

export async function POST({ request }) {
  try {
    const body = await request.json();
    const { email, status, courseUrl, courseTitle } = body;

    if (!email || !status) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    const host = import.meta.env.SMTP_HOST;
    const port = import.meta.env.SMTP_PORT;
    const user = import.meta.env.SMTP_USER;
    const pass = import.meta.env.SMTP_PASS;
    const fromEmail = import.meta.env.SMTP_FROM_EMAIL || '"FreeYTCourses" <noreply@freeytcourses.com>';

    if (!host || !user || !pass) {
      console.warn("SMTP credentials not fully configured. Email was not sent.");
      return new Response(JSON.stringify({ message: 'SMTP not configured. Email skipped.' }), { status: 200 });
    }

    const transporter = nodemailer.createTransport({
      host: host,
      port: parseInt(port || '587', 10),
      secure: port === '465', // true for 465, false for other ports
      auth: {
        user: user,
        pass: pass,
      },
    });

    let subject = '';
    let htmlContent = '';
    const courseNameStr = courseTitle ? `"${courseTitle}"` : "your course";

    if (status === 'approved') {
      subject = 'Your Course has been Approved! 🎉';
      htmlContent = `
        <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 8px; padding: 24px;">
          <h2 style="color: #10B981;">Course Approved!</h2>
          <p>Hi there,</p>
          <p>Great news! We have reviewed your submission for <strong>${courseNameStr}</strong> and it has been approved to be featured on FreeYTCourses.</p>
          <p>You can check it out live on the platform now.</p>
          ${courseUrl ? `<p>Submitted URL: <a href="${courseUrl}">${courseUrl}</a></p>` : ''}
          <p>Thank you for contributing to the community!</p>
          <br/>
          <p>Best regards,<br/>The FreeYTCourses Team</p>
        </div>
      `;
    } else if (status === 'rejected') {
      subject = 'Update regarding your Course Submission';
      htmlContent = `
        <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 8px; padding: 24px;">
          <h2 style="color: #EF4444;">Course Submission Update</h2>
          <p>Hi there,</p>
          <p>Thank you for submitting your course to FreeYTCourses.</p>
          <p>After careful review, we are unable to accept your submission for <strong>${courseNameStr}</strong> at this time. We receive many submissions and unfortunately cannot feature all of them.</p>
          ${courseUrl ? `<p>Submitted URL: <a href="${courseUrl}">${courseUrl}</a></p>` : ''}
          <p>We appreciate your effort and hope you'll consider submitting other high-quality free courses in the future.</p>
          <br/>
          <p>Best regards,<br/>The FreeYTCourses Team</p>
        </div>
      `;
    } else {
       return new Response(JSON.stringify({ error: 'Invalid status' }), { status: 400 });
    }

    await transporter.sendMail({
      from: fromEmail,
      to: email,
      subject: subject,
      html: htmlContent,
    });

    return new Response(JSON.stringify({ success: true, message: 'Email sent successfully' }), { status: 200 });

  } catch (err) {
    console.error("Error sending email:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

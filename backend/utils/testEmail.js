const { sendMail } = require("./sendMail");

const testEmail = async () => {
    try {
        await sendMail({
            to: "stanashady1@gmail.com",
            subject: "testing email",
            text: "email successfull"
        });
        return { message: "Test email sent successfully" };
    } catch (error) {
        console.error("Error sending test email:", error);
        return { error: error.message };
    }
};

testEmail();
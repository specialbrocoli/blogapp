import User from '../models/user.model.js';
import Post from '../models/post.model.js';
import Comment from '../models/comment.model.js';
import { Webhook } from 'svix';

export const clerkWebHook = async (req, res) => {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET is missing!');
    return res.status(500).json({ message: 'Webhook secret needed!' });
  }

  console.log('Webhook received, headers:', req.headers);

  const payload = req.body;
  const headers = req.headers;

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt;
  try {
    evt = wh.verify(payload, headers);
  } catch (err) {
    console.error('Webhook verification failed:', err.message);
    return res.status(400).json({
      message: 'Webhook verification failed!',
      error: err.message,
    });
  }

  // console.log(evt.data);
  console.log('Webhook event type:', evt.type);
  console.log('Event data:', JSON.stringify(evt.data, null, 2));

  if (evt.type === 'user.created') {
    try {
      console.log('Creating new user:', evt.data.id);
      console.log('email_addresses:', evt.data.email_addresses);
      console.log('username:', evt.data.username);
      console.log(
        'primary_email_address_id:',
        evt.data.primary_email_address_id
      );

      // Safely get email
      const email = evt.data.email_addresses?.[0]?.email_address;

      if (!email) {
        console.error('No email found in webhook data - likely a test event');
        console.log('Available fields:', Object.keys(evt.data));
        console.log('email_addresses array:', evt.data.email_addresses);
        return res.status(200).json({
          message: 'Test event received (no email data)',
          note: 'Real user signups will have email data',
        });
      }

      const newUser = new User({
        clerkUserId: evt.data.id,
        username: evt.data.username || email,
        email: email,
        img: evt.data.profile_image_url || evt.data.image_url || '',
      });

      await newUser.save();
      console.log('User created successfully:', newUser.username);
    } catch (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({
        message: 'Error creating user',
        error: error.message,
      });
    }
  }

  if (evt.type === 'user.updated') {
    try {
      const email = evt.data.email_addresses?.[0]?.email_address;

      const updatedUser = await User.findOneAndUpdate(
        { clerkUserId: evt.data.id },
        {
          username: evt.data.username || email,
          email: email,
          img: evt.data.profile_image_url || evt.data.image_url || '',
        },
        { new: true }
      );

      if (updatedUser) {
        console.log('User updated successfully:', updatedUser.username);
      } else {
        console.log('User not found for update:', evt.data.id);
      }
    } catch (error) {
      console.error('Error updating user:', error);
      return res.status(500).json({
        message: 'Error updating user',
        error: error.message,
      });
    }
  }

  if (evt.type === 'user.deleted') {
    try {
      const deletedUser = await User.findOneAndDelete({
        clerkUserId: evt.data.id,
      });

      if (deletedUser) {
        await Post.deleteMany({ user: deletedUser._id });
        await Comment.deleteMany({ user: deletedUser._id });
        console.log('User deleted successfully:', deletedUser.username);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      return res.status(500).json({
        message: 'Error deleting user',
        error: error.message,
      });
    }
  }

  return res.status(200).json({
    message: 'Webhook received',
  });
};

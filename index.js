const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIO = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(cors());
mongoose.connect('mongodb+srv://amin:aE5NlhQbFjNAKxZ6@cluster0.9uxdkkn.mongodb.net/?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true });

const Driver = mongoose.model('Driverrr', {
  name: String,
  availability: {
    days: [String],
    startTime: String,
    endTime: String,
  },
  location: {
    type: {
      type: String,
      default: 'Point',
    },
    coordinates: [Number],
  },
});

const MAX_RANGE_METERS = 1000;

app.use(express.json());

app.post('/updateUserLocation/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { latitude, longitude } = req.body;

    if (!userId || !latitude || !longitude) {
      return res.status(400).json({ error: 'Invalid input. Please provide valid location details.' });
    }

    await Driver.findByIdAndUpdate(userId, {
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      },
    });

    res.status(200).json({ message: 'User location updated successfully.' });
  } catch (error) {
    console.error('Error updating user location:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/createDriver', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Invalid input. Please provide a name for the driver.' });
    }

    const newDriver = new Driver({ name });
    await newDriver.save();

    res.status(201).json({ message: 'Driver created successfully.', driverId: newDriver._id });
  } catch (error) {
    console.error('Error creating driver:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/updateAvailability/:driverId', async (req, res) => {
    try {
      const { driverId } = req.params;
      const { availability } = req.body;
  
      if (!driverId || !availability || !availability.days || !availability.startTime || !availability.endTime) {
        return res.status(400).json({ error: 'Invalid input. Please provide valid availability details.' });
      }
  
      const { startTime, endTime } = availability;
  
      await Driver.findByIdAndUpdate(driverId, { availability: { days: availability.days, startTime, endTime } });
  
      res.status(200).json({ message: 'Availability updated successfully.' });
    } catch (error) {
      console.error('Error updating availability:', error);
      res.status(500).json({ error: 'Internal server error.' });
    }
  });
  
app.get('/', (req, res) => {
  res.send('Welcome to the real-time location tracking server!');
});

io.on('connection', (socket) => {
  console.log('User connected');

  socket.on('updateLocation', async (data) => {
    const { driverId, latitude, longitude } = data;

    const currentDay = getDay();
    const currentTime = getCurrentTime();

    await Driver.findByIdAndUpdate(driverId, {
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      },
    });

    const driver = await Driver.findById(driverId);

    if (driver.availability && driver.availability.days.includes(currentDay)) {
      if (isTimeInWindow(currentTime, driver.availability.startTime, driver.availability.endTime)) {
        const distance = calculateDistance(
          [parseFloat(longitude), parseFloat(latitude)],
          [/*31.2648658*/, /*30.7078421*/]
        );

        if (distance <= MAX_RANGE_METERS) {
          io.emit('locationUpdate', {
            driverId,
            latitude,
            longitude,
          });
        } else {
          console.log(`Driver ${driverId} is outside the allowed range.`);
        }
      } else {
        console.log(`Driver ${driverId} is outside the allowed time window.`);
      }
    } else {
      console.log(`Driver ${driverId} is not available at the current day.`);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

function calculateDistance(point1, point2) {
  const R = 6371000;
  const [lat1, lon1] = point1;
  const [lat2, lon2] = point2;

  const dLat = degToRad(lat2 - lat1);
  const dLon = degToRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degToRad(lat1)) * Math.cos(degToRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function degToRad(degrees) {
  return degrees * (Math.PI / 180);
}

function getDay() {
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDate = new Date();
  return daysOfWeek[currentDate.getDay()];
}

function getCurrentTime() {
  const currentDate = new Date();
  const hours = currentDate.getHours().toString().padStart(2, '0');
  const minutes = currentDate.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

const PORT = process.env.PORT || 3100;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

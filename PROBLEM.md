# The Problem

## What I saw

I went to a doctor's clinic near my home. About 100 patients come there every day.

There is no appointment system. You walk in. The receptionist writes your name in a
notebook. That notebook is your place in line.

Then you wait. You cannot go anywhere.

When your turn comes, the receptionist calls your name out loud. If you hear it, you go
in. If you do not hear it, you have a problem.

I sat there for two hours. There were close to a hundred people in the room with me.
Both numbers are from memory, so treat them as approximate.

## The real problem

At first I thought the notebook was the problem. It is not. The notebook works fine. It
keeps the correct order and it never crashes.

The real problem is this:

**The only way to learn your turn is to stand close enough to hear one man's voice.**

A voice carries about twenty feet. So every patient has to stay inside those twenty feet.
A hundred people sit in one room for hours. Most of them need only ten minutes with the
doctor.

The waiting is not caused by the doctor being slow. It is caused by there being no way to
tell someone their turn from far away.

And the penalty for getting it wrong is severe. Miss your name and you start again at the
back. So nobody risks leaving, even for a few minutes.

## What goes wrong

1. **You cannot check your own position.** Only the receptionist can read the notebook. So
   you have to keep asking him.

2. **You cannot leave.** Not for food, not for a washroom that is too far. You might miss
   your name.

3. **You cannot plan.** You do not know if you have ten minutes left or three hours.

4. **If you miss your call, you go to the end of the line.** I saw this happen. The man
   did not lose a few places. He lost all of them and started again behind everyone else.
   So stepping outside for five minutes, after already waiting an hour, can cost you two
   more hours.

5. **Your name is announced to the whole room.** Everyone now knows who you are and that
   you are seeing this doctor.

6. **The receptionist is interrupted all day.** People keep asking "how many before me?"
   That is a part of his job that should not need to exist.

7. **At the end of the day, the notebook closes.** Nobody knows how long people actually
   waited. So nothing ever improves.

## Why a token machine alone is not enough

Some places already give printed tokens. Banks and government offices do this.

Tokens fix one thing. The order becomes clear, so people stop arguing about who came
first.

But tokens do not fix the main problem. The display screen is inside the hall. You still
have to stand there and watch it. You still cannot leave.

**Tokens fix fairness. They do not give you your time back.**

## What this system changes

- Your token is on your phone. You can see your number and how many people are ahead of
  you.
- You can walk away. Sit outside, get tea, go home if you live close. Your phone keeps
  showing your position.
- You get an estimate of when your turn will come.
- If you miss your call, staff can recall you. You do not go back to the end of the line.
- The display shows a number, not your name. Nobody in the room learns who you are.
- Staff stop answering "how many ahead of me". The screen answers it.
- Every ticket is timestamped, so the clinic can see the real waiting time at the end of
  the day.

## One design rule that comes straight from the problem

Once people are allowed to leave, a wrong estimate becomes dangerous.

If the system says **45 minutes** and the real wait is 20, the patient goes far away and
misses their turn, and in this clinic that means going to the end of the line. The system
has now cost them two hours. It has made things worse than the notebook.

If the system says **20 minutes** and the real wait is 45, the patient comes back early
and sits for a while. Nothing bad happens.

So the estimate leans early on purpose. The system shows a range, and **the smaller number
is the one that matters**. It means "be back by this time".

## What this does not fix

- **It assumes everyone in a queue takes about the same time.** The estimate is
  built from one average per service. That holds for general consultation, where
  almost every patient needs about ten minutes. It would not hold for a queue
  mixing a ten-minute job with a fifty-minute one. The wait shown would be wrong
  for most of the people reading it, and the wait is the whole reason anyone
  feels safe leaving.
- **It does not make the doctor faster.** If a hundred people each need ten minutes, that
  is still a long day. This project moves waiting out of the room. It does not remove it.
- **It does not help someone without a smartphone.** This is a real gap. The public display
  screen is there for them, but they still have to stay nearby.
- **It is not for emergencies.** In a hospital emergency room the sickest person goes
  first, not the person who arrived first. This system is first-come-first-served by
  design, so it does not belong there.
- **It only works if staff actually use it.** If the receptionist keeps the old notebook
  open on the side, nothing changes.

## Where else this happens

The same thing happens anywhere people wait in a crowd without appointments.

**Barber shop.** You walk in, he nods at you, you sit down. One haircut takes ten minutes
and the next takes fifty, so nobody can guess. You wait the whole time.

**College office.** Fee counter, exam forms, document verification. One clerk, a crowd,
and your name called out over the noise.

The pattern is the same in all of them:

1. The order is first-come-first-served, and it is honest
2. The call has a short range
3. Nobody knows how long each person will take

If all three are true, this problem exists.

## Why this does not exist already

It does exist. It is just distributed by budget.

Large hospital chains have an app that shows your OPD token. Big restaurants hand you a
buzzer or send you an SMS. Those are the same solution in a different shape.

The clinic near my home sees a hundred patients a day and uses a notebook.

The engineering here is not hard. What is missing is a version a single small clinic can
actually run.

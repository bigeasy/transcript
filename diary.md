# Diary

You can store the checksum of the previous entry in the header of the next
entry if you want to maintain integrity across the entire file.

Deciding that I don't want this to passively write provided buffers. I want it
to emit buffers according to some allocation strategy. That way, it can fill a
buffer and leave it in a queue of buffers to write. You grab the buffers and
reset the queue, or there's a function to do it.

This way, the object is also a buffering object, writing headers directly too
the buffers. If you give it strings for header and body, it will write them out
UTF-8, so we're not creating little buffers and big buffers.

Reading buffers will create an object that must be consummed immediately, which
may simply mean you clone the buffer.

We can work to put objects in a single buffer, so that writing them will mean
that they tend to chunk correctly.
